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

  const { contactId, stageId, funnelId, title, notes } = await req.json()

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
    position,
  }).select().single()

  return NextResponse.json({ lead })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, stageId, position, notes, title } = await req.json()

  const updates: Record<string, unknown> = {}
  if (stageId !== undefined) updates.stage_id = stageId
  if (position !== undefined) updates.position = position
  if (notes !== undefined) updates.notes = notes
  if (title !== undefined) updates.title = title

  await supabase().from('crm_leads').update(updates).eq('id', id)
  return NextResponse.json({ success: true })
}
