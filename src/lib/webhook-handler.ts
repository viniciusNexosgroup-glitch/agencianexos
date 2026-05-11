import { createClient } from '@supabase/supabase-js'
import { fetchGroupInfo, getMediaBase64 } from './evolution'
import { runFlowsForMessage } from './flow-engine'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function processWebhookEvent(body: any) {
  const db = supabase()
  const rawEvent: string = body.event || ''
  const event = rawEvent.toUpperCase().replace(/\./g, '_').replace(/-/g, '_')
  const instance: string = body.instance || body.data?.instance || ''

  console.log('Webhook received:', event, 'instance:', instance)

  // ── QR CODE ────────────────────────────────────────────────
  if (event === 'QRCODE_UPDATED') {
    const qr = body.data?.qrcode?.base64 || body.data?.base64 || null
    if (qr && instance) {
      await db.from('whatsapp_instances')
        .update({ qr_base64: qr })
        .eq('instance_name', instance)
    }
  }

  // ── CONNECTION ─────────────────────────────────────────────
  if (event === 'CONNECTION_UPDATE') {
    const state = body.data?.state || body.data?.instance?.state || ''
    const status = state === 'open' ? 'connected' : 'disconnected'
    const updates: Record<string, unknown> = { status }
    if (status === 'connected') updates.qr_base64 = null
    if (instance) {
      await db.from('whatsapp_instances')
        .update(updates)
        .eq('instance_name', instance)
    }
  }

  // ── CONTACTS UPDATE (foto de perfil) ──────────────────────
  if (event === 'CONTACTS_UPDATE') {
    const list = Array.isArray(body.data) ? body.data : [body.data]
    await Promise.all(
      list.map(async (c: any) => {
        const jid: string = c?.remoteJid || ''
        const pic: string | null = c?.profilePicUrl || null
        if (!jid || !instance || !pic) return
        const phone = jid.endsWith('@g.us') ? jid : jid.replace('@s.whatsapp.net', '').replace('@lid', '')
        if (!phone) return
        await db.from('whatsapp_contacts')
          .update({ profile_pic_url: pic })
          .eq('instance_name', instance)
          .eq('phone', phone)
      })
    )
  }

  // ── CHATS UPDATE (leitura no WhatsApp → zera badge no CRM) ──
  if (event === 'CHATS_UPDATE' || event === 'CHATS_UPSERT') {
    const chats = Array.isArray(body.data) ? body.data : [body.data]
    await Promise.all(
      chats.map(async (chat: any) => {
        const remoteJid: string = chat?.id || chat?.remoteJid || ''
        // unreadCount === 0 significa que o usuário leu as mensagens no WhatsApp
        const unread = chat?.unreadCount ?? chat?.unread_count ?? chat?.unread ?? -1
        if (remoteJid && instance && unread === 0) {
          const phone = remoteJid.endsWith('@g.us')
            ? remoteJid
            : remoteJid.replace('@s.whatsapp.net', '').replace('@lid', '')
          await db.from('whatsapp_contacts')
            .update({ unread_count: 0 })
            .eq('instance_name', instance)
            .eq('phone', phone)
            .gt('unread_count', 0) // só atualiza se realmente havia não lidas
        }
      })
    )
  }

  // ── GROUPS ─────────────────────────────────────────────────
  if (event === 'GROUPS_UPSERT' || event === 'GROUPS_UPDATE') {
    const groups = Array.isArray(body.data) ? body.data : [body.data]
    // Paraleliza upserts de grupos em vez de fazer sequencial
    await Promise.all(
      groups.map(async (group: any) => {
        const jid     = group?.id || group?.remoteJid || ''
        const subject = group?.subject || ''
        if (jid && subject && instance) {
          await db.from('whatsapp_contacts').upsert(
            { instance_name: instance, phone: jid, remote_jid: jid, name: subject },
            { onConflict: 'instance_name,phone' }
          )
        }
      })
    )
  }

  // ── STATUS DE MENSAGEM (entregue, lido, etc.) ──────────────
  if (event === 'MESSAGES_UPDATE') {
    const updates = Array.isArray(body.data) ? body.data : [body.data]
    await Promise.all(
      updates.map(async (u: any) => {
        const msgId: string = u?.key?.id || ''
        const status: number | undefined = u?.update?.status
        if (msgId && status !== undefined) {
          await db.from('whatsapp_messages')
            .update({ status: Number(status) })
            .eq('message_id', msgId)
        }
      })
    )
  }

  // ── MESSAGES ───────────────────────────────────────────────
  if (event === 'MESSAGES_UPSERT') {
    const messages = Array.isArray(body.data) ? body.data : [body.data]

    // Cache de nomes para evitar N+1 queries quando batch tem múltiplas msgs do mesmo contato
    const contactNameCache = new Map<string, string>()

    for (const msg of messages) {
      if (!msg?.key?.remoteJid) continue
      const remoteJid = msg.key.remoteJid

      if (remoteJid.endsWith('@lid') || remoteJid === 'status@broadcast') continue

      const isGroup = remoteJid.endsWith('@g.us')
      const phone   = isGroup ? remoteJid : remoteJid.replace('@s.whatsapp.net', '')
      const fromMe  = msg.key.fromMe ?? false

      // Ignora chaves de metadados para encontrar o tipo real da mensagem
      const META_KEYS = new Set(['messageContextInfo', 'deviceSentMessage', 'senderKeyDistributionMessage'])
      // Desempacota mensagens aninhadas (deviceSentMessage, ephemeralMessage, etc.)
      const innerMsg = msg.message?.deviceSentMessage?.message || msg.message || {}
      const msgType = Object.keys(innerMsg).find(k => !META_KEYS.has(k)) || 'text'

      // Mensagem apagada para todos (protocolMessage REVOKE)
      if (msgType === 'protocolMessage' && innerMsg.protocolMessage?.type === 'REVOKE') {
        const deletedId = innerMsg.protocolMessage?.key?.id
        if (deletedId) {
          await db.from('whatsapp_messages')
            .update({ message_type: 'revoked', body: '', media_url: null, media_data: null })
            .eq('message_id', deletedId)
        }
        continue
      }

      // Voto em enquete: atualiza media_data da enquete original
      if (msgType === 'pollUpdateMessage') {
        const update = innerMsg.pollUpdateMessage
        const pollMsgId = update?.pollCreationMessageKey?.id
        const selectedOptions: string[] = update?.vote?.selectedOptions ?? []
        const voter = fromMe ? 'me' : phone

        if (pollMsgId) {
          const { data: pollMsg } = await db.from('whatsapp_messages')
            .select('id, media_data')
            .eq('message_id', pollMsgId)
            .maybeSingle()

          if (pollMsg?.media_data) {
            const md = pollMsg.media_data as Record<string, unknown>
            const votes = { ...((md.votes as Record<string, string[]>) ?? {}) }

            if (selectedOptions.length === 0) {
              delete votes[voter]
            } else {
              votes[voter] = selectedOptions
            }

            const options = ((md.options as Array<{ name: string; votes: number }>) ?? []).map(opt => ({
              ...opt,
              votes: Object.values(votes).filter((v) => Array.isArray(v) && v.includes(opt.name)).length,
            }))

            await db.from('whatsapp_messages')
              .update({ media_data: { ...md, votes, options } })
              .eq('id', pollMsg.id)
          }
        }
        continue
      }

      // Reação: atualiza a mensagem alvo e não insere nova mensagem
      if (msgType === 'reactionMessage') {
        const reaction = innerMsg.reactionMessage
        const targetMsgId = reaction?.key?.id
        const emoji = reaction?.text || ''
        if (targetMsgId) {
          const reactor = fromMe ? 'me' : (msg.key.participant?.replace('@s.whatsapp.net', '') || phone)
          const { data: targetMsg } = await db.from('whatsapp_messages')
            .select('id, reactions')
            .eq('message_id', targetMsgId)
            .maybeSingle()
          if (targetMsg) {
            const reactions = { ...(targetMsg.reactions || {}) }
            if (emoji) reactions[reactor] = emoji
            else delete reactions[reactor]
            await db.from('whatsapp_messages').update({ reactions }).eq('id', targetMsg.id)
          }
        }
        continue
      }

      const text    = innerMsg.conversation
        || innerMsg.extendedTextMessage?.text
        || innerMsg.imageMessage?.caption
        || innerMsg.videoMessage?.caption
        || innerMsg.pollCreationMessage?.name
        || ''
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      // Participante do grupo (Evolution API pode colocar em msg.key.participant ou msg.participant)
      const participantJid  = isGroup ? (msg.key.participant || msg.participant || '') : ''
      const participantName = isGroup ? (msg.pushName || participantJid.replace('@s.whatsapp.net', '')) : ''

      // Nome do contato: usa cache para evitar N+1 queries em batches com múltiplas msgs do mesmo número
      let contactName: string
      if (isGroup) {
        const cached = contactNameCache.get(phone)
        if (cached) {
          contactName = cached
        } else {
          const { data: existing } = await db.from('whatsapp_contacts')
            .select('name')
            .eq('instance_name', instance)
            .eq('phone', phone)
            .maybeSingle()
          const hasRealName = existing?.name && !existing.name.endsWith('@g.us') && existing.name !== phone
          if (hasRealName) {
            contactName = existing!.name
          } else {
            const fetched = await fetchGroupInfo(instance, remoteJid)
            contactName = fetched || existing?.name || phone
          }
          contactNameCache.set(phone, contactName)
        }
      } else if (fromMe) {
        const cached = contactNameCache.get(phone)
        if (cached) {
          contactName = cached
        } else {
          const { data: existing } = await db.from('whatsapp_contacts')
            .select('name')
            .eq('instance_name', instance)
            .eq('phone', phone)
            .maybeSingle()
          contactName = existing?.name || phone
          contactNameCache.set(phone, contactName)
        }
      } else {
        contactName = msg.pushName || phone
      }

      const referral = msg.referral || msg.message?.referral || null
      const utm = {
        utm_source: referral?.source_url ? 'facebook' : null,
        utm_medium: referral?.source_type === 'AD' ? 'cpc' : null,
        utm_campaign: referral?.headline || null,
        ad_id: referral?.ad_id || null,
        ad_name: referral?.ad_name || null,
        adset_id: referral?.adset_id || null,
        campaign_id_meta: referral?.campaign_id || null,
        source_url: referral?.source_url || null,
      }

      // Monta preview da última mensagem (igual ao WhatsApp)
      const mediaLabels: Record<string, string> = {
        imageMessage: '📷 Foto',
        videoMessage: '🎥 Vídeo',
        audioMessage: '🎵 Áudio',
        ptvMessage: '🎥 Vídeo',
        documentMessage: '📄 Documento',
        stickerMessage: '🌟 Sticker',
      }
      const msgPreview = mediaLabels[msgType] ?? text
      const lastMessageBody = fromMe
        ? `Você: ${msgPreview}`
        : isGroup && participantName
          ? `${participantName}: ${msgPreview}`
          : msgPreview

      const { error } = await db.rpc('process_whatsapp_message', {
        p_instance_name:    instance,
        p_phone:            phone,
        p_message_id:       msg.key.id,
        p_contact_name:     contactName,
        p_remote_jid:       remoteJid,
        p_body:             text,
        p_from_me:          fromMe,
        p_timestamp:        timestamp,
        p_message_type:     msgType,
        p_participant_name: participantName || null,
        p_participant_jid:  participantJid  || null,
      })

      if (!error) {
        await db.from('whatsapp_contacts')
          .update({ last_message_body: lastMessageBody })
          .eq('instance_name', instance)
          .eq('phone', phone)
      }

      if (error) {
        console.error('Erro ao processar mensagem via RPC:', error.message)
      }

      // Baixar mídia e armazenar como base64
      const DOWNLOADABLE = ['imageMessage', 'audioMessage', 'stickerMessage', 'ptvMessage']
      if (!error && DOWNLOADABLE.includes(msgType)) {
        try {
          const mediaInfo = await getMediaBase64(instance, msg)
          if (mediaInfo?.base64) {
            const mime = mediaInfo.mimetype.split(';')[0].trim()
            await db.from('whatsapp_messages')
              .update({ media_url: `data:${mime};base64,${mediaInfo.base64}` })
              .eq('message_id', msg.key.id)
          }
        } catch { /* falha silenciosa */ }
      }

      // Contato compartilhado: salva vcard em media_data
      if (!error && msgType === 'contactMessage') {
        const c = innerMsg.contactMessage
        if (c?.vcard) {
          await db.from('whatsapp_messages')
            .update({ media_data: { displayName: c.displayName || '', vcard: c.vcard } })
            .eq('message_id', msg.key.id)
        }
      }
      if (!error && msgType === 'contactsArrayMessage') {
        const contacts = (innerMsg.contactsArrayMessage?.contacts ?? []) as Array<{ displayName?: string; vcard?: string }>
        if (contacts.length > 0) {
          await db.from('whatsapp_messages')
            .update({ media_data: { contacts: contacts.map(c => ({ displayName: c.displayName || '', vcard: c.vcard || '' })) } })
            .eq('message_id', msg.key.id)
        }
      }

      // Vídeo: salva thumbnail + dados completos do vídeo (mediaKey, url, etc.) para download sob demanda
      if (!error && msgType === 'videoMessage') {
        const videoMsg = innerMsg.videoMessage
        if (videoMsg) {
          const updates: Record<string, unknown> = {}
          // Thumbnail para preview
          if (videoMsg.jpegThumbnail) {
            updates.media_url = `data:image/jpeg;base64,${videoMsg.jpegThumbnail}`
          }
          // Salva dados completos do vídeo (necessário para descriptografar depois)
          const { jpegThumbnail: _t, ...videoData } = videoMsg
          updates.media_data = {
            key: { remoteJid, fromMe, id: msg.key.id, participant: msg.key.participant || null },
            message: { videoMessage: videoData },
          }
          await db.from('whatsapp_messages').update(updates).eq('message_id', msg.key.id)
        }
      }

      // Documento: salva metadados (nome, tipo, tamanho) + dados para download sob demanda
      if (!error && msgType === 'documentMessage') {
        const docMsg = innerMsg.documentMessage
        if (docMsg) {
          const { jpegThumbnail: _t, ...docData } = docMsg as Record<string, unknown>
          await db.from('whatsapp_messages').update({
            media_data: {
              fileName: (docMsg as Record<string, unknown>).title || (docMsg as Record<string, unknown>).fileName || 'documento',
              mimetype: (docMsg as Record<string, unknown>).mimetype || 'application/octet-stream',
              fileLength: (docMsg as Record<string, unknown>).fileLength ? Number((docMsg as Record<string, unknown>).fileLength) : null,
              key: { remoteJid, fromMe, id: msg.key.id, participant: msg.key.participant || null },
              message: { documentMessage: docData },
            },
          }).eq('message_id', msg.key.id)
        }
      }

      // Enquete: salva nome e opções em media_data para renderização no CRM
      if (!error && msgType === 'pollCreationMessage') {
        const poll = innerMsg.pollCreationMessage
        if (poll?.options) {
          await db.from('whatsapp_messages').update({
            media_data: {
              name: poll.name ?? text,
              options: (poll.options as Array<{ optionName?: string; name?: string }>).map(o => ({
                name: o.optionName ?? o.name ?? '',
                votes: 0,
              })),
              selectableCount: poll.selectableOptionsCount ?? 1,
              votes: {},
            }
          }).eq('message_id', msg.key.id)
        }
      }

      // Contexto de resposta (reply/quoted message)
      const contextInfo = innerMsg.extendedTextMessage?.contextInfo
        || innerMsg.imageMessage?.contextInfo
        || innerMsg.audioMessage?.contextInfo
        || null
      if (!error && contextInfo?.quotedMessage && contextInfo?.stanzaId) {
        const qMsg = contextInfo.quotedMessage
        const quotedBody = qMsg.conversation
          || qMsg.extendedTextMessage?.text
          || qMsg.imageMessage?.caption
          || qMsg.videoMessage?.caption
          || '[mídia]'
        const senderPhone = contextInfo.participant?.replace('@s.whatsapp.net', '') || null
        try {
          const { data: existing } = await db.from('whatsapp_messages')
            .select('media_data')
            .eq('message_id', msg.key.id)
            .maybeSingle()
          const merged = { ...(existing?.media_data as Record<string, unknown> || {}), _reply: {
            id: contextInfo.stanzaId,
            body: quotedBody,
            sender_name: senderPhone,
            from_me: !contextInfo.participant,
          }}
          await db.from('whatsapp_messages').update({ media_data: merged }).eq('message_id', msg.key.id)
        } catch { /* falha silenciosa */ }
      }

      // Incrementa não lidas para mensagens recebidas; zera para enviadas por mim
      if (!fromMe) {
        await db.rpc('increment_unread_count', { p_instance_name: instance, p_phone: phone })
      } else {
        // Garante que mensagem enviada por mim não incremente o badge (defensivo contra RPC)
        await db.from('whatsapp_contacts')
          .update({ unread_count: 0 })
          .eq('instance_name', instance)
          .eq('phone', phone)
          .gt('unread_count', 0)
      }

      // Executa flows ativos para mensagens recebidas (independente de erro na RPC)
      if (!fromMe && !isGroup) {
        const { data: contactForFlow } = await db
          .from('whatsapp_contacts')
          .select('id')
          .eq('instance_name', instance)
          .eq('phone', phone)
          .maybeSingle()

        console.log('[Flow] contato encontrado:', contactForFlow?.id, 'text:', text, 'instance:', instance)

        if (contactForFlow?.id) {
          const { count: msgCount } = await db
            .from('whatsapp_messages')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contactForFlow.id)

          const isFirstMessage = (msgCount ?? 0) <= 1

          await runFlowsForMessage(db, instance, remoteJid, contactForFlow.id, text, isFirstMessage)
        }
      }

      if (!error && referral && Object.values(utm).some(v => v !== null)) {
        await db.from('whatsapp_contacts')
          .update(utm)
          .eq('instance_name', instance)
          .eq('phone', phone)
          .is('utm_source', null)
      }

      // Auto-criar lead na etapa "Lead" quando for mensagem recebida de novo contato
      // Usa o contato já buscado na seção de flows acima (evita query duplicada)
      if (!error && !fromMe && !isGroup) {
        const { data: contactForLead } = await db
          .from('whatsapp_contacts')
          .select('id')
          .eq('instance_name', instance)
          .eq('phone', phone)
          .maybeSingle()

        if (contactForLead?.id) {
          const { count } = await db
            .from('crm_leads')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contactForLead.id)

          if ((count ?? 0) === 0) {
            const { data: leadStage } = await db
              .from('crm_stages')
              .select('id, funnel_id')
              .eq('name', 'Lead')
              .order('position', { ascending: true })
              .limit(1)
              .single()

            if (leadStage) {
              const { data: maxPos } = await db
                .from('crm_leads')
                .select('position')
                .eq('stage_id', leadStage.id)
                .order('position', { ascending: false })
                .limit(1)
                .single()

              // try/catch torna idempotente: se dois webhooks simultâneos tentarem criar o mesmo lead,
              // o segundo falhará silenciosamente (DB constraint ou contagem desatualizada)
              try {
                await db.from('crm_leads').insert({
                  contact_id: contactForLead.id,
                  stage_id: leadStage.id,
                  funnel_id: leadStage.funnel_id,
                  title: contactName || phone,
                  position: (maxPos?.position ?? -1) + 1,
                })
              } catch { /* lead já criado por webhook concorrente */ }
            }
          }
        }
      }
    }
  }
}
