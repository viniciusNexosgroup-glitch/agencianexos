import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getUserInstanceNames } from '@/lib/tenant'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const thresholdMin = parseInt(req.nextUrl.searchParams.get('threshold_min') ?? '60', 10)
  const cutoff = new Date(Date.now() - thresholdMin * 60 * 1000).toISOString()

  const db = supabase()
  const names = await getUserInstanceNames(session)
  if (names !== null && names.length === 0) return NextResponse.json({ contacts: [] })

  let contactsQuery = db
    .from('whatsapp_contacts')
    .select('id, name, phone, instance_name, last_message_at')
    .lte('last_message_at', cutoff)
    .order('last_message_at', { ascending: true })
    .limit(50)
  if (names !== null) contactsQuery = contactsQuery.in('instance_name', names)

  const { data: contacts } = await contactsQuery

  if (!contacts || contacts.length === 0) {
    return NextResponse.json({ contacts: [] })
  }

  const contactIds = contacts.map(c => c.id)

  const { data: lastOutbound } = await db
    .from('whatsapp_messages')
    .select('contact_id, timestamp')
    .eq('from_me', true)
    .in('contact_id', contactIds)
    .order('timestamp', { ascending: false })

  const lastReplyByContact = new Map<string, string>()
  for (const msg of lastOutbound ?? []) {
    if (!lastReplyByContact.has(msg.contact_id)) {
      lastReplyByContact.set(msg.contact_id, msg.timestamp)
    }
  }

  const { data: lastInbound } = await db
    .from('whatsapp_messages')
    .select('contact_id, body, timestamp')
    .eq('from_me', false)
    .in('contact_id', contactIds)
    .order('timestamp', { ascending: false })

  const lastMsgByContact = new Map<string, { body: string; timestamp: string }>()
  for (const msg of lastInbound ?? []) {
    if (!lastMsgByContact.has(msg.contact_id)) {
      lastMsgByContact.set(msg.contact_id, { body: msg.body, timestamp: msg.timestamp })
    }
  }

  const unanswered = contacts.filter(c => {
    const lastReply = lastReplyByContact.get(c.id)
    const lastMsg = lastMsgByContact.get(c.id)
    if (!lastMsg) return false
    if (!lastReply) return true
    return new Date(lastMsg.timestamp) > new Date(lastReply)
  }).map(c => {
    const lastMsg = lastMsgByContact.get(c.id)
    return {
      contact_id: c.id,
      contact_name: c.name || c.phone,
      last_message: lastMsg?.body ?? '',
      waiting_since: lastMsg?.timestamp ?? c.last_message_at,
      instance_name: c.instance_name,
    }
  })

  return NextResponse.json({ contacts: unanswered })
}
