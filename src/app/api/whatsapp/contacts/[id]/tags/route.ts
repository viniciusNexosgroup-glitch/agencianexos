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

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!await canAccessContact(params.id, session)) return denied()

  const { data, error } = await supabase()
    .from('contact_tags')
    .select('tag_id, tags(id, name, color)')
    .eq('contact_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const tags = (data ?? []).map((row: { tags: unknown }) => row.tags)

  return NextResponse.json({ tags })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!await canAccessContact(params.id, session)) return denied()

  const body = await req.json()
  const { tag_id } = body

  if (!tag_id) return NextResponse.json({ error: 'tag_id é obrigatório' }, { status: 400 })

  const { error } = await supabase()
    .from('contact_tags')
    .upsert(
      { contact_id: params.id, tag_id },
      { onConflict: 'contact_id,tag_id', ignoreDuplicates: true }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!await canAccessContact(params.id, session)) return denied()

  const tag_id = req.nextUrl.searchParams.get('tag_id')
  if (!tag_id) return NextResponse.json({ error: 'tag_id é obrigatório' }, { status: 400 })

  const { error } = await supabase()
    .from('contact_tags')
    .delete()
    .eq('contact_id', params.id)
    .eq('tag_id', tag_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
