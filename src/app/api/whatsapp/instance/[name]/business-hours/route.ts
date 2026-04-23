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

export async function GET(
  _req: NextRequest,
  { params }: { params: { name: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabase()

  const [hoursResult, instanceResult] = await Promise.all([
    db
      .from('business_hours')
      .select('weekday, open_time, close_time, is_active')
      .eq('instance_name', params.name)
      .order('weekday'),
    db
      .from('whatsapp_instances')
      .select('away_message, timezone')
      .eq('instance_name', params.name)
      .single(),
  ])

  if (hoursResult.error) {
    return NextResponse.json({ error: hoursResult.error.message }, { status: 500 })
  }

  return NextResponse.json({
    weekdays: hoursResult.data ?? [],
    away_message: instanceResult.data?.away_message ?? null,
    timezone: instanceResult.data?.timezone ?? 'America/Sao_Paulo',
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { weekday, open_time, close_time, is_active } = body

  if (weekday === undefined || weekday === null || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
    return NextResponse.json({ error: 'weekday deve ser um inteiro entre 0 e 6' }, { status: 400 })
  }
  if (!open_time || !close_time) {
    return NextResponse.json({ error: 'open_time e close_time são obrigatórios' }, { status: 400 })
  }

  const timeRegex = /^\d{2}:\d{2}$/
  if (!timeRegex.test(open_time) || !timeRegex.test(close_time)) {
    return NextResponse.json({ error: 'open_time e close_time devem estar no formato HH:MM' }, { status: 400 })
  }

  const { data, error } = await supabase()
    .from('business_hours')
    .upsert(
      {
        instance_name: params.name,
        weekday,
        open_time,
        close_time,
        is_active: is_active ?? true,
      },
      { onConflict: 'instance_name,weekday' }
    )
    .select('weekday, open_time, close_time, is_active')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ businessHour: data }, { status: 201 })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { name: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const updates: Record<string, unknown> = {}

  if (body.away_message !== undefined) updates.away_message = body.away_message
  if (body.timezone !== undefined) updates.timezone = body.timezone

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo para atualizar' }, { status: 400 })
  }

  const { error } = await supabase()
    .from('whatsapp_instances')
    .update(updates)
    .eq('instance_name', params.name)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
