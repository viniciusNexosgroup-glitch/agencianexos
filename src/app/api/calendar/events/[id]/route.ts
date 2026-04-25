import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { deleteGoogleEvent, updateGoogleEvent } from '@/lib/google-calendar'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { title, description, location, start_at, end_at, all_day, color, contact_name, contact_phone } = body

  const db = supabase()

  const { data: existing } = await db
    .from('calendar_events')
    .select('google_event_id')
    .eq('id', params.id)
    .eq('user_email', session.email)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  if (existing.google_event_id && title && start_at && end_at) {
    try {
      await updateGoogleEvent(session.email, existing.google_event_id, {
        title, description, location, startAt: start_at, endAt: end_at, allDay: all_day,
      })
    } catch (err) {
      console.error('Erro ao atualizar evento no Google Calendar:', err)
    }
  }

  const updates: Record<string, unknown> = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (location !== undefined) updates.location = location
  if (start_at !== undefined) updates.start_at = start_at
  if (end_at !== undefined) updates.end_at = end_at
  if (all_day !== undefined) updates.all_day = all_day
  if (color !== undefined) updates.color = color
  if (contact_name !== undefined) updates.contact_name = contact_name
  if (contact_phone !== undefined) updates.contact_phone = contact_phone
  updates.updated_at = new Date().toISOString()

  const { data, error } = await db
    .from('calendar_events')
    .update(updates)
    .eq('id', params.id)
    .eq('user_email', session.email)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ event: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabase()

  const { data: existing } = await db
    .from('calendar_events')
    .select('google_event_id')
    .eq('id', params.id)
    .eq('user_email', session.email)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Evento não encontrado' }, { status: 404 })

  if (existing.google_event_id) {
    try {
      await deleteGoogleEvent(session.email, existing.google_event_id)
    } catch (err) {
      console.error('Erro ao deletar evento no Google Calendar:', err)
    }
  }

  await db
    .from('calendar_events')
    .delete()
    .eq('id', params.id)
    .eq('user_email', session.email)

  return NextResponse.json({ ok: true })
}
