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

  const { data } = await supabase()
    .from('departments')
    .select('*, department_members(user_id, clients(id, name, email))')
    .order('created_at', { ascending: true })

  return NextResponse.json({ departments: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('departments')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ department: data })
}

export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, name, add_user_id, remove_user_id, contact_id, department_id } = await req.json()
  const db = supabase()

  // Atribuir contato a departamento
  if (contact_id !== undefined) {
    await db.from('whatsapp_contacts').update({ department_id: department_id || null }).eq('id', contact_id)
    return NextResponse.json({ success: true })
  }

  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  if (name) {
    await db.from('departments').update({ name }).eq('id', id)
  }

  if (add_user_id) {
    await db.from('department_members').upsert({ department_id: id, user_id: add_user_id })
  }

  if (remove_user_id) {
    await db.from('department_members').delete().eq('department_id', id).eq('user_id', remove_user_id)
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 })

  const { error } = await supabase().from('departments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
