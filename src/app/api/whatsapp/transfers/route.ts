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

  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id obrigatório' }, { status: 400 })

  const { data } = await supabase()
    .from('conversation_assignments')
    .select('*, clients!to_agent(id, name, email)')
    .eq('contact_id', contactId)
    .order('assigned_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: contact } = await supabase()
    .from('whatsapp_contacts')
    .select('assigned_to, clients!whatsapp_contacts_assigned_to_fkey(id, name, email)')
    .eq('id', contactId)
    .maybeSingle()

  return NextResponse.json({ assignment: data ?? null, current_agent: (contact as any)?.clients ?? null })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { contact_id, to_agent_id, note } = await req.json()
  if (!contact_id || !to_agent_id) {
    return NextResponse.json({ error: 'contact_id e to_agent_id são obrigatórios' }, { status: 400 })
  }

  const db = supabase()

  const { data: assignment, error } = await db
    .from('conversation_assignments')
    .insert({
      contact_id,
      from_agent: session.id,
      to_agent: to_agent_id,
      note: note || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db
    .from('whatsapp_contacts')
    .update({ assigned_to: to_agent_id })
    .eq('id', contact_id)

  return NextResponse.json({ success: true, assignment })
}
