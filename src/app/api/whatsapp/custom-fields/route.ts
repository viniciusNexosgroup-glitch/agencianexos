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

  const { data, error } = await supabase()
    .from('custom_field_definitions')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ fields: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, field_type, options, position } = body

  if (!name || !field_type) {
    return NextResponse.json({ error: 'name e field_type são obrigatórios' }, { status: 400 })
  }

  const validTypes = ['text', 'number', 'date', 'boolean', 'select', 'multiselect']
  if (!validTypes.includes(field_type)) {
    return NextResponse.json({ error: `field_type inválido. Use: ${validTypes.join(', ')}` }, { status: 400 })
  }

  const db = supabase()

  let resolvedPosition = position
  if (resolvedPosition === undefined || resolvedPosition === null) {
    const { data: maxPos } = await db
      .from('custom_field_definitions')
      .select('position')
      .order('position', { ascending: false })
      .limit(1)
      .single()

    resolvedPosition = (maxPos?.position ?? -1) + 1
  }

  const { data, error } = await db
    .from('custom_field_definitions')
    .insert({
      name,
      field_type,
      options: options ?? null,
      position: resolvedPosition,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ field: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { error } = await supabase()
    .from('custom_field_definitions')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
