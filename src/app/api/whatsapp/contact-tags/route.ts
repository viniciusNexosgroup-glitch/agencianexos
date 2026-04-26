import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// Retorna todas as relações contact→tags em um único objeto { [contact_id]: Tag[] }
// Usa service role para bypass de RLS (evita falha silenciosa no cliente browser)
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabase()
  const [{ data: ctData }, { data: tagsData }] = await Promise.all([
    db.from('contact_tags').select('contact_id, tag_id'),
    db.from('tags').select('id, name, color'),
  ])

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
