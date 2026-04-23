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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const db = supabase()

  const { data: agents, error: agentsError } = await db
    .from('clients')
    .select('id, name, email')
    .eq('is_admin', true)

  if (agentsError) return NextResponse.json({ error: agentsError.message }, { status: 500 })

  const { data: contacts, error: contactsError } = await db
    .from('whatsapp_contacts')
    .select('id, assigned_to')
    .not('assigned_to', 'is', null)

  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 })

  const contactsByAgent = new Map<string, string[]>()
  for (const contact of contacts ?? []) {
    if (!contact.assigned_to) continue
    if (!contactsByAgent.has(contact.assigned_to)) contactsByAgent.set(contact.assigned_to, [])
    contactsByAgent.get(contact.assigned_to)!.push(contact.id)
  }

  const { data: messages, error: messagesError } = await db
    .from('whatsapp_messages')
    .select('contact_id, timestamp, from_me')
    .eq('from_me', true)
    .gte('timestamp', since)

  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 })

  const { data: inboundMessages, error: inboundError } = await db
    .from('whatsapp_messages')
    .select('contact_id, timestamp, from_me')
    .eq('from_me', false)
    .gte('timestamp', since)

  if (inboundError) return NextResponse.json({ error: inboundError.message }, { status: 500 })

  const inboundByContact = new Map<string, string[]>()
  for (const msg of inboundMessages ?? []) {
    if (!inboundByContact.has(msg.contact_id)) inboundByContact.set(msg.contact_id, [])
    inboundByContact.get(msg.contact_id)!.push(msg.timestamp)
  }

  const outboundByContact = new Map<string, string[]>()
  for (const msg of messages ?? []) {
    if (!outboundByContact.has(msg.contact_id)) outboundByContact.set(msg.contact_id, [])
    outboundByContact.get(msg.contact_id)!.push(msg.timestamp)
  }

  const result = (agents ?? []).map((agent) => {
    const agentContactIds = contactsByAgent.get(agent.id) ?? []

    let totalMessages = 0
    const attendedContacts = new Set<string>()
    let totalResponseMs = 0
    let responseCount = 0

    for (const contactId of agentContactIds) {
      const outbound = outboundByContact.get(contactId) ?? []
      const inbound = inboundByContact.get(contactId) ?? []

      if (outbound.length > 0) attendedContacts.add(contactId)
      totalMessages += outbound.length

      const sortedInbound = [...inbound].sort()
      const sortedOutbound = [...outbound].sort()

      for (const inTs of sortedInbound) {
        const response = sortedOutbound.find((outTs) => outTs > inTs)
        if (response) {
          totalResponseMs += new Date(response).getTime() - new Date(inTs).getTime()
          responseCount++
        }
      }
    }

    const avgResponseMinutes =
      responseCount > 0 ? Math.round((totalResponseMs / responseCount / 60000) * 10) / 10 : null

    return {
      agent_id: agent.id,
      agent_name: agent.name,
      agent_email: agent.email,
      total_messages: totalMessages,
      total_contacts: attendedContacts.size,
      avg_response_time_minutes: avgResponseMinutes,
    }
  })

  return NextResponse.json({ agents: result, period_days: days })
}
