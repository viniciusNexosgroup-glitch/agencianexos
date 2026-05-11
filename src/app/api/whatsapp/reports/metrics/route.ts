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

  const db = supabase()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const since = todayStart.toISOString()

  const names = await getUserInstanceNames(session)
  if (names !== null && names.length === 0) {
    return NextResponse.json({ metrics: { total_contacts_today: 0, messages_sent_today: 0, avg_response_time_min: null, avg_csat: null } })
  }

  let msgsBase = db.from('whatsapp_messages').select('contact_id', { count: 'exact', head: true }).gte('timestamp', since)
  let msgsSentBase = db.from('whatsapp_messages').select('id', { count: 'exact', head: true }).eq('from_me', true).gte('timestamp', since)
  if (names !== null) {
    msgsBase = msgsBase.in('instance_name', names)
    msgsSentBase = msgsSentBase.in('instance_name', names)
  }

  const [{ count: contactsToday }, { count: msgsSent }, { data: csatData }] = await Promise.all([
    msgsBase,
    msgsSentBase,
    db.from('csat_responses').select('score').gte('created_at', since),
  ])

  const scores = (csatData ?? []).map(r => r.score).filter(Boolean)
  const avgCsat = scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null

  return NextResponse.json({
    metrics: {
      total_contacts_today: contactsToday ?? 0,
      messages_sent_today: msgsSent ?? 0,
      avg_response_time_min: null,
      avg_csat: avgCsat,
    }
  })
}
