import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { createGoogleEvent, listGoogleEvents, listGoogleCalendars } from '@/lib/google-calendar'

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

  const db = supabase()

  let query = db
    .from('calendar_events')
    .select('*')
    .eq('user_email', session.email)
    .order('start_at', { ascending: true })

  if (start) query = query.gte('start_at', start)
  if (end) query = query.lte('start_at', end)

  const { data: localEvents, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Verifica se Google Calendar está conectado
  const { data: tokenData } = await db
    .from('google_calendar_tokens')
    .select('user_email')
    .eq('user_email', session.email)
    .maybeSingle()

  if (!tokenData) {
    return NextResponse.json({ events: localEvents ?? [] })
  }

  // Busca lista de calendários do usuário
  const googleCals = await listGoogleCalendars(session.email)
  const colorMap: Record<string, string> = {}
  googleCals.forEach(c => { if (c.id) colorMap[c.id] = c.backgroundColor ?? '#4285f4' })
  const calIds = googleCals.map(c => c.id).filter(Boolean) as string[]

  // Busca eventos de todos os calendários em paralelo
  const allCalItems = await Promise.all(
    calIds.map(async calId => {
      const items = await listGoogleEvents(session.email, calId, start ?? undefined, end ?? undefined)
      return items.map(item => ({ ...item, _calendarId: calId, _calendarColor: colorMap[calId] ?? '#4285f4' }))
    })
  )
  const googleItems = allCalItems.flat()

  // IDs do Google já salvos localmente (para evitar duplicatas)
  const localGoogleIds = new Set((localEvents ?? []).map(e => e.google_event_id).filter(Boolean))

  // Converte eventos do Google para o formato do app, excluindo os que já existem localmente
  const googleOnlyEvents = googleItems
    .filter(item => item.id && !localGoogleIds.has(item.id) && item.status !== 'cancelled')
    .map(item => ({
      id: `google_${item.id}`,
      user_email: session.email,
      title: item.summary ?? '(sem título)',
      description: item.description ?? null,
      location: item.location ?? null,
      start_at: item.start?.dateTime ?? `${item.start?.date}T00:00:00.000Z`,
      end_at: item.end?.dateTime ?? `${item.end?.date}T23:59:59.000Z`,
      all_day: !item.start?.dateTime,
      color: item._calendarColor,
      contact_name: null,
      contact_phone: null,
      synced_to_google: true,
      google_event_id: item.id ?? null,
      calendar_id: item._calendarId,
    }))

  const allEvents = [...(localEvents ?? []), ...googleOnlyEvents]
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

  return NextResponse.json({ events: allEvents })
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
