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

  const db = supabase()
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const since = todayStart.toISOString()

  const [{ count: contactsToday }, { count: msgsSent }, { data: csatData }] = await Promise.all([
    db.from('whatsapp_messages')
      .select('contact_id', { count: 'exact', head: true })
      .gte('timestamp', since),
    db.from('whatsapp_messages')
      .select('id', { count: 'exact', head: true })
      .eq('from_me', true)
      .gte('timestamp', since),
    db.from('csat_responses')
      .select('score')
      .gte('created_at', since),
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
