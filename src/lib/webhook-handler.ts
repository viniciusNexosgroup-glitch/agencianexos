import { createClient } from '@supabase/supabase-js'
import { fetchGroupInfo } from './evolution'

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
      const text    = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
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
        p_message_type:     Object.keys(msg.message || {})[0] || 'text',
        p_participant_name: participantName || null,
        p_participant_jid:  participantJid  || null,
      })

      if (error) {
        console.error('Erro ao processar mensagem via RPC:', error.message)
      }

      if (!error && referral && Object.values(utm).some(v => v !== null)) {
        await db.from('whatsapp_contacts')
          .update(utm)
          .eq('instance_name', instance)
          .eq('phone', phone)
          .is('utm_source', null)
      }
    }
  }
}
