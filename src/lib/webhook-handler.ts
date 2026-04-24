import { createClient } from '@supabase/supabase-js'
import { fetchGroupInfo, getMediaBase64 } from './evolution'

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

  // ── MESSAGES ───────────────────────────────────────────────
  if (event === 'MESSAGES_UPSERT') {
    const messages = Array.isArray(body.data) ? body.data : [body.data]

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
        || ''
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      // Participante do grupo (Evolution API pode colocar em msg.key.participant ou msg.participant)
      const participantJid  = isGroup ? (msg.key.participant || msg.participant || '') : ''
      const participantName = isGroup ? (msg.pushName || participantJid.replace('@s.whatsapp.net', '')) : ''

      // Nome do contato: grupos buscam da Evolution API se não tiver nome real ainda
      let contactName: string
      if (isGroup) {
        // Verifica se já existe um nome real no banco antes de chamar a API
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
      } else if (fromMe) {
        // Para mensagens enviadas por mim, pushName é meu próprio nome — preservar nome existente do contato
        const { data: existing } = await db.from('whatsapp_contacts')
          .select('name')
          .eq('instance_name', instance)
          .eq('phone', phone)
          .maybeSingle()
        contactName = existing?.name || phone
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

      if (error) {
        console.error('Erro ao processar mensagem via RPC:', error.message)
      }

      // Baixar mídia (imagem, áudio, sticker) e armazenar como base64
      const DOWNLOADABLE = ['imageMessage', 'audioMessage', 'stickerMessage', 'ptvMessage']
      if (!error && DOWNLOADABLE.includes(msgType)) {
        try {
          const mediaInfo = await getMediaBase64(instance, msg)
          if (mediaInfo?.base64) {
            const mime = mediaInfo.mimetype.split(';')[0].trim()
            const dataUrl = `data:${mime};base64,${mediaInfo.base64}`
            await db.from('whatsapp_messages')
              .update({ media_url: dataUrl })
              .eq('message_id', msg.key.id)
          }
        } catch {
          // falha silenciosa: mensagem fica sem media_url
        }
      }

      // Incrementa não lidas para qualquer mensagem recebida (individual ou grupo)
      if (!fromMe) {
        await db.rpc('increment_unread_count', { p_instance_name: instance, p_phone: phone })
      }

      if (!error && referral && Object.values(utm).some(v => v !== null)) {
        await db.from('whatsapp_contacts')
          .update(utm)
          .eq('instance_name', instance)
          .eq('phone', phone)
          .is('utm_source', null)
      }

      // Auto-criar lead na etapa "Lead" quando for mensagem recebida de novo contato
      if (!error && !fromMe && !isGroup) {
        const { data: contact } = await db
          .from('whatsapp_contacts')
          .select('id')
          .eq('instance_name', instance)
          .eq('phone', phone)
          .single()

        if (contact?.id) {
          const { count } = await db
            .from('crm_leads')
            .select('id', { count: 'exact', head: true })
            .eq('contact_id', contact.id)

          if ((count ?? 0) === 0) {
            // Busca a etapa "Lead" no primeiro funil disponível
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

              await db.from('crm_leads').insert({
                contact_id: contact.id,
                stage_id: leadStage.id,
                funnel_id: leadStage.funnel_id,
                title: contactName || phone,
                position: (maxPos?.position ?? -1) + 1,
              })
            }
          }
        }
      }
    }
  }
}
