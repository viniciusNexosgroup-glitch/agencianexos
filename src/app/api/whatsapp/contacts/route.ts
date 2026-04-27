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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const names = await getUserInstanceNames(session)
  if (names !== null && names.length === 0) {
    return NextResponse.json({ contacts: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  let q = supabase()
    .from('whatsapp_contacts')
    .select('id, name, phone, instance_name, last_message_at, remote_jid, unread_count, profile_pic_url, follow_up')
    .not('phone', 'like', '%@lid')
    .not('phone', 'eq', 'status@broadcast')
    .order('last_message_at', { ascending: false })
    .limit(500)

  if (names !== null) q = q.in('instance_name', names)

  const { data } = await q
  return NextResponse.json({ contacts: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
