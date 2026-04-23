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

  const funnelId = req.nextUrl.searchParams.get('funnel_id')
  let query = supabase()
    .from('crm_leads')
    .select('*, whatsapp_contacts(*), crm_stages(name, position)')
    .order('position', { ascending: true })

  if (funnelId) query = query.eq('funnel_id', funnelId)

  const { data } = await query
  return NextResponse.json({ leads: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { contactId, stageId, funnelId, title, notes, value } = await req.json()

  const { data: maxPos } = await supabase()
    .from('crm_leads')
    .select('position')
    .eq('stage_id', stageId)
    .order('position', { ascending: false })
    .limit(1)
    .single()

  const position = (maxPos?.position ?? -1) + 1

  const { data: lead } = await supabase().from('crm_leads').insert({
    contact_id: contactId,
    stage_id: stageId,
    funnel_id: funnelId,
    title: title || 'Lead',
    notes: notes || '',
    value: value || 0,
    position,
  }).select().single()

  return NextResponse.json({ lead })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase().from('crm_leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { id, stageId, position, notes, title, value } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (stageId !== undefined) updates.stage_id = stageId
  if (position !== undefined) updates.position = position
  if (notes !== undefined) updates.notes = notes
  if (title !== undefined) updates.title = title
  if (value !== undefined) updates.value = value

  const { error } = await supabase().from('crm_leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
