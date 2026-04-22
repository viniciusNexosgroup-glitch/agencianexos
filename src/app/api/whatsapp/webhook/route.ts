import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const db = supabase()

  if (body.event === 'QRCODE_UPDATED') {
    const { instance, data } = body
    const qr = data?.qrcode?.base64 || data?.base64 || null
    if (qr) {
      await db.from('whatsapp_instances').update({ qr_base64: qr }).eq('instance_name', instance)
    }
  }

  if (body.event === 'CONNECTION_UPDATE') {
    const { instance, data } = body
    const status = data?.state === 'open' ? 'connected' : 'disconnected'
    const updates: Record<string, unknown> = { status }
    if (status === 'connected') updates.qr_base64 = null
    await db.from('whatsapp_instances').update(updates).eq('instance_name', instance)
  }

  if (body.event === 'MESSAGES_UPSERT') {
    const { instance, data } = body
    const messages = Array.isArray(data) ? data : [data]

    for (const msg of messages) {
      if (!msg?.key?.remoteJid || msg.key.remoteJid.endsWith('@g.us')) continue

      const remoteJid = msg.key.remoteJid
      const phone = remoteJid.replace('@s.whatsapp.net', '')
      const fromMe = msg.key.fromMe ?? false
      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || ''
      const timestamp = msg.messageTimestamp
        ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      const pushName = msg.pushName || ''

      // Upsert contact
      await db.from('whatsapp_contacts').upsert({
        instance_name: instance,
        phone,
        name: pushName || phone,
        remote_jid: remoteJid,
        last_message_at: timestamp,
      }, { onConflict: 'instance_name,phone' })

      // Get contact id
      const { data: contact } = await db
        .from('whatsapp_contacts')
        .select('id')
        .eq('instance_name', instance)
        .eq('phone', phone)
        .single()

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

  return NextResponse.json({ ok: true })
}
