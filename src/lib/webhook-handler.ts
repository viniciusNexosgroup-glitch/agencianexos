import { createClient } from '@supabase/supabase-js'

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

  if (event === 'QRCODE_UPDATED') {
    const qr = body.data?.qrcode?.base64 || body.data?.base64 || null
    console.log('QR received, length:', qr?.length)
    if (qr && instance) {
      await db.from('whatsapp_instances').update({ qr_base64: qr }).eq('instance_name', instance)
    }
  }

  if (event === 'CONNECTION_UPDATE') {
    const state = body.data?.state || body.data?.instance?.state || ''
    const status = state === 'open' ? 'connected' : 'disconnected'
    const updates: Record<string, unknown> = { status }
    if (status === 'connected') updates.qr_base64 = null
    if (instance) {
      await db.from('whatsapp_instances').update(updates).eq('instance_name', instance)
    }
  }

  if (event === 'MESSAGES_UPSERT') {
    const messages = Array.isArray(body.data) ? body.data : [body.data]
    for (const msg of messages) {
      if (!msg?.key?.remoteJid) continue
      const remoteJid = msg.key.remoteJid
      // Skip @lid (linked devices) and broadcast
      if (remoteJid.endsWith('@lid') || remoteJid === 'status@broadcast') continue
      const isGroup = remoteJid.endsWith('@g.us')
      const phone = isGroup ? remoteJid : remoteJid.replace('@s.whatsapp.net', '')
      const fromMe = msg.key.fromMe ?? false
      const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || ''
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      // For groups, use group subject/name; for individuals use pushName
      const name = isGroup
        ? (msg.groupMetadata?.subject || msg.pushName || remoteJid)
        : (msg.pushName || phone)

      await db.from('whatsapp_contacts').upsert({
        instance_name: instance,
        phone,
        name,
        remote_jid: remoteJid,
        last_message_at: timestamp,
      }, { onConflict: 'instance_name,phone' })

      const { data: contact } = await db
        .from('whatsapp_contacts').select('id')
        .eq('instance_name', instance).eq('phone', phone).single()

      if (contact) {
        await db.from('whatsapp_messages').upsert({
          contact_id: contact.id,
          instance_name: instance,
          message_id: msg.key.id,
          from_me: fromMe,
          body: text,
          message_type: Object.keys(msg.message || {})[0] || 'text',
          timestamp,
        }, { onConflict: 'message_id' })
      }
    }
  }
}
