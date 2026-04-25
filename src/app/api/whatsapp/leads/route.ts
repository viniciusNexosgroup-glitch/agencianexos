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
  const contactId = req.nextUrl.searchParams.get('contact_id')

  if (contactId) {
    const { data: lead } = await supabase()
      .from('crm_leads')
      .select('id, stage_id, contact_id, funnel_id')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    return NextResponse.json({ lead: lead ?? null })
  }

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

  const body = await req.json()
  const { contact_id, notes, value } = body
  let { contactId, stageId, funnelId, title } = body

  // Suporta contact_id (snake_case) além de contactId
  if (!contactId && contact_id) contactId = contact_id

  // Se não foi passado stageId, busca a primeira etapa "Lead" disponível
  if (!stageId) {
    const { data: stage } = await supabase()
      .from('crm_stages')
      .select('id, funnel_id')
      .eq('name', 'Lead')
      .order('position', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (stage) {
      stageId = stage.id
      funnelId = stage.funnel_id
    }
  }

  const { data: maxPos } = await supabase()
    .from('crm_leads')
    .select('position')
    .eq('stage_id', stageId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

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

  const { id, stageId, stage_id, position, notes, title, value } = await req.json()
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const resolvedStageId = stageId ?? stage_id

  const updates: Record<string, unknown> = {}
  if (resolvedStageId !== undefined) updates.stage_id = resolvedStageId
  if (position !== undefined) updates.position = position
  if (notes !== undefined) updates.notes = notes
  if (title !== undefined) updates.title = title
  if (value !== undefined) updates.value = value

  const { error } = await supabase().from('crm_leads').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: lead } = await supabase()
    .from('crm_leads')
    .select('id, stage_id, contact_id, funnel_id')
    .eq('id', id)
    .single()

  return NextResponse.json({ success: true, lead })
}
