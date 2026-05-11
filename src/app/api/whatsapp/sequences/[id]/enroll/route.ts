import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { canAccessContact, denied } from '@/lib/tenant'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: sequenceId } = params
  const body = await req.json()
  const { contact_id } = body

  if (!contact_id) return NextResponse.json({ error: 'contact_id é obrigatório' }, { status: 400 })

  if (!await canAccessContact(contact_id, session)) return denied()

  const db = supabase()

  const { data: firstStep, error: stepError } = await db
    .from('sequence_steps')
    .select('delay_hours')
    .eq('sequence_id', sequenceId)
    .order('position', { ascending: true })
    .limit(1)
    .single()

  if (stepError || !firstStep) {
    return NextResponse.json({ error: 'Sequência não encontrada ou sem steps' }, { status: 404 })
  }

  const delayMs = (firstStep.delay_hours ?? 0) * 60 * 60 * 1000
  const nextSendAt = new Date(Date.now() + delayMs).toISOString()

  const { data: enrollment, error } = await db
    .from('sequence_enrollments')
    .upsert(
      {
        sequence_id: sequenceId,
        contact_id,
        current_step: 0,
        next_send_at: nextSendAt,
        status: 'active',
        enrolled_by: session.sub,
      },
      { onConflict: 'sequence_id,contact_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ enrollment }, { status: 201 })
}
