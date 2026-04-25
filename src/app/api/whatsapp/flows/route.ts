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

  const db = supabase()

  const { data: flows, error } = await db
    .from('flows')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const flowIds = (flows ?? []).map((f) => f.id)

  let executionCounts: Record<string, number> = {}
  if (flowIds.length > 0) {
    const { data: executions } = await db
      .from('flow_executions')
      .select('flow_id')
      .in('flow_id', flowIds)
      .eq('status', 'active')

    for (const exec of executions ?? []) {
      executionCounts[exec.flow_id] = (executionCounts[exec.flow_id] ?? 0) + 1
    }
  }

  const result = (flows ?? []).map((flow) => ({
    ...flow,
    active_executions: executionCounts[flow.id] ?? 0,
  }))

  return NextResponse.json({ flows: result })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, instance_name, trigger_type, trigger_value } = body

  if (!name || !instance_name || !trigger_type) {
    return NextResponse.json({ error: 'name, instance_name e trigger_type são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase()
    .from('flows')
    .insert({
      name,
      instance_name,
      trigger_type,
      trigger_value: trigger_value ?? null,
      is_active: false,
      steps: body.steps ?? [],
      created_by: session.sub,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flow: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { error } = await supabase()
    .from('flows')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
