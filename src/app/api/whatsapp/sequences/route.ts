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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  let q = supabase().from('sequences').select('*, sequence_steps(*)').order('created_at', { ascending: false })
  if (!session.is_admin) q = q.eq('created_by', session.sub)

  const { data, error } = await q

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ sequences: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, trigger_event, steps } = body

  if (!name || !trigger_event) {
    return NextResponse.json({ error: 'name e trigger_event são obrigatórios' }, { status: 400 })
  }

  if (!Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: 'steps deve ser um array não vazio' }, { status: 400 })
  }

  const db = supabase()

  const { data: sequence, error: seqError } = await db
    .from('sequences')
    .insert({ name, trigger_event, created_by: session.sub })
    .select()
    .single()

  if (seqError || !sequence) return NextResponse.json({ error: seqError?.message ?? 'Erro ao criar sequência' }, { status: 500 })

  const stepsToInsert = steps.map((step: { delay_hours: number; body: string }, index: number) => ({
    sequence_id: sequence.id,
    position: index,
    delay_hours: step.delay_hours,
    body: step.body,
  }))

  const { data: insertedSteps, error: stepsError } = await db
    .from('sequence_steps')
    .insert(stepsToInsert)
    .select()

  if (stepsError) {
    await db.from('sequences').delete().eq('id', sequence.id)
    return NextResponse.json({ error: stepsError.message }, { status: 500 })
  }

  return NextResponse.json({ sequence: { ...sequence, sequence_steps: insertedSteps } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const db = supabase()

  await db.from('sequence_enrollments').delete().eq('sequence_id', id)
  await db.from('sequence_steps').delete().eq('sequence_id', id)
  const { error } = await db.from('sequences').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
