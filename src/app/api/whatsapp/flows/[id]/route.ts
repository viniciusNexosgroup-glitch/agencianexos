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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const db = supabase()

  const { data: flow, error: flowError } = await db
    .from('flows')
    .select('*')
    .eq('id', id)
    .single()

  if (flowError || !flow) return NextResponse.json({ error: 'Flow não encontrado' }, { status: 404 })

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    db.from('flow_nodes').select('*').eq('flow_id', id).order('created_at', { ascending: true }),
    db.from('flow_edges').select('*').eq('flow_id', id),
  ])

  return NextResponse.json({ flow, nodes: nodes ?? [], edges: edges ?? [] })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const body = await req.json()
  const { nodes, edges } = body

  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return NextResponse.json({ error: 'nodes e edges devem ser arrays' }, { status: 400 })
  }

  const db = supabase()

  const { data: flow } = await db.from('flows').select('id').eq('id', id).single()
  if (!flow) return NextResponse.json({ error: 'Flow não encontrado' }, { status: 404 })

  await Promise.all([
    db.from('flow_nodes').delete().eq('flow_id', id),
    db.from('flow_edges').delete().eq('flow_id', id),
  ])

  if (nodes.length > 0) {
    const { error: nodesError } = await db
      .from('flow_nodes')
      .insert(nodes.map((n) => ({ ...n, flow_id: id })))

    if (nodesError) return NextResponse.json({ error: nodesError.message }, { status: 500 })
  }

  if (edges.length > 0) {
    const { error: edgesError } = await db
      .from('flow_edges')
      .insert(edges.map((e) => ({ ...e, flow_id: id })))

    if (edgesError) return NextResponse.json({ error: edgesError.message }, { status: 500 })
  }

  await db.from('flows').update({ updated_at: new Date().toISOString() }).eq('id', id)

  const [{ data: savedNodes }, { data: savedEdges }] = await Promise.all([
    db.from('flow_nodes').select('*').eq('flow_id', id),
    db.from('flow_edges').select('*').eq('flow_id', id),
  ])

  return NextResponse.json({ nodes: savedNodes ?? [], edges: savedEdges ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const body = await req.json()

  if (body.action !== 'toggle') {
    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  }

  const db = supabase()

  const { data: flow } = await db.from('flows').select('id, is_active').eq('id', id).single()
  if (!flow) return NextResponse.json({ error: 'Flow não encontrado' }, { status: 404 })

  const { data: updated, error } = await db
    .from('flows')
    .update({ is_active: !flow.is_active, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ flow: updated })
}
