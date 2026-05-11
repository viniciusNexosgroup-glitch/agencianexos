import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getUserInstanceNames } from '@/lib/tenant'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Retorna todas as relações contact→tags filtradas pelo tenant do usuário
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabase()

  // Determina os IDs de contato acessíveis pelo usuário
  let contactIds: string[] | null = null
  if (!session.is_admin) {
    const names = await getUserInstanceNames(session)
    if (names !== null && names.length === 0) {
      return NextResponse.json({ contactTags: {} })
    }
    if (names !== null) {
      const { data: contacts } = await db
        .from('whatsapp_contacts')
        .select('id')
        .in('instance_name', names)
      contactIds = (contacts ?? []).map(c => c.id as string)
      if (contactIds.length === 0) return NextResponse.json({ contactTags: {} })
    }
  }

  let ctQuery = db.from('contact_tags').select('contact_id, tag_id')
  if (contactIds !== null) ctQuery = ctQuery.in('contact_id', contactIds)

  let tagsQuery = db.from('tags').select('id, name, color')
  if (!session.is_admin) tagsQuery = tagsQuery.eq('created_by', session.sub)

  const [{ data: ctData }, { data: tagsData }] = await Promise.all([ctQuery, tagsQuery])

  const tagsById = Object.fromEntries((tagsData ?? []).map(t => [t.id, t]))
  const contactTags: Record<string, unknown[]> = {}

  for (const ct of ctData ?? []) {
    const tag = tagsById[ct.tag_id]
    if (tag) {
      contactTags[ct.contact_id] = [...(contactTags[ct.contact_id] ?? []), tag]
    }
  }

  return NextResponse.json({ contactTags })
}
