import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { createGoogleEvent } from '@/lib/google-calendar'

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

  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')

  let query = supabase()
    .from('calendar_events')
    .select('*')
    .eq('user_email', session.email)
    .order('start_at', { ascending: true })

  if (start) query = query.gte('start_at', start)
  if (end) query = query.lte('start_at', end)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ events: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { title, description, location, start_at, end_at, all_day, color, contact_name, contact_phone } = body

  if (!title || !start_at || !end_at) {
    return NextResponse.json({ error: 'Campos obrigatórios: title, start_at, end_at' }, { status: 400 })
  }

  const db = supabase()

  // Check if Google Calendar is connected
  const { data: tokenData } = await db
    .from('google_calendar_tokens')
    .select('user_email')
    .eq('user_email', session.email)
    .maybeSingle()

  let googleEventId: string | null = null
  if (tokenData) {
    try {
      googleEventId = await createGoogleEvent(session.email, {
        title,
        description,
        location,
        startAt: start_at,
        endAt: end_at,
        allDay: all_day ?? false,
      })
    } catch (err) {
      console.error('Erro ao criar evento no Google Calendar:', err)
    }
  }

  const { data, error } = await db
    .from('calendar_events')
    .insert({
      user_email: session.email,
      title,
      description: description ?? null,
      location: location ?? null,
      start_at,
      end_at,
      all_day: all_day ?? false,
      color: color ?? '#00a884',
      contact_name: contact_name ?? null,
      contact_phone: contact_phone ?? null,
      google_event_id: googleEventId,
      synced_to_google: !!googleEventId,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ event: data }, { status: 201 })
}
