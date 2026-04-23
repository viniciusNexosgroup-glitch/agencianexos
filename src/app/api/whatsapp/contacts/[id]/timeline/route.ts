import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: contactId } = params
  const db = supabase()

  const { data: events, error: eventsError } = await db
    .from('contact_events')
    .select('*, clients:created_by(id, name)')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 })

  const { data: messages, error: messagesError } = await db
    .from('whatsapp_messages')
    .select('id, body, from_me, timestamp, type')
    .eq('contact_id', contactId)
    .order('timestamp', { ascending: false })
    .limit(5)

  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 })

  const messageEvents = (messages ?? []).map((msg) => ({
    id: `msg_${msg.id}`,
    contact_id: contactId,
    event_type: 'message',
    description: msg.body ?? `[${msg.type ?? 'media'}]`,
    metadata: { from_me: msg.from_me, type: msg.type },
    created_at: msg.timestamp,
    created_by: null,
    clients: null,
    source: 'message',
  }))

  const contactEvents = (events ?? []).map((e) => ({ ...e, source: 'event' }))

  const timeline = [...contactEvents, ...messageEvents].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return NextResponse.json({ timeline })
}
