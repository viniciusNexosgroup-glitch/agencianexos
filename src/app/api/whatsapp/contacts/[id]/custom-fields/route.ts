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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: contactId } = params

  if (!await canAccessContact(contactId, session)) return denied()

  const db = supabase()

  const { data: definitions, error: defError } = await db
    .from('custom_field_definitions')
    .select('*')
    .eq('is_active', true)
    .order('position', { ascending: true })

  if (defError) return NextResponse.json({ error: defError.message }, { status: 500 })

  const { data: values, error: valError } = await db
    .from('contact_custom_field_values')
    .select('*')
    .eq('contact_id', contactId)

  if (valError) return NextResponse.json({ error: valError.message }, { status: 500 })

  const valueMap = new Map((values ?? []).map((v) => [v.field_id, v]))

  const fields = (definitions ?? []).map((def) => {
    const val = valueMap.get(def.id)
    return {
      field_id: def.id,
      name: def.name,
      field_type: def.field_type,
      options: def.options,
      position: def.position,
      value: val?.value ?? null,
      value_id: val?.id ?? null,
    }
  })

  return NextResponse.json({ fields })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id: contactId } = params

  if (!await canAccessContact(contactId, session)) return denied()

  const body = await req.json()
  const { field_id, value } = body

  if (!field_id) return NextResponse.json({ error: 'field_id é obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('contact_custom_field_values')
    .upsert(
      { contact_id: contactId, field_id, value: value ?? null, updated_by: session.sub },
      { onConflict: 'contact_id,field_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ field_value: data })
}
