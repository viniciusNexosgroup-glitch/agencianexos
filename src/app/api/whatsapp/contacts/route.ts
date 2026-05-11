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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  // Sempre filtra pelas instâncias do próprio usuário (admin não vê contatos de outros)
  const { data: instances } = await supabase()
    .from('whatsapp_instances')
    .select('instance_name')
    .eq('created_by', session.email)

  const instanceNames = (instances ?? []).map(i => i.instance_name as string)
  if (instanceNames.length === 0) {
    return NextResponse.json({ contacts: [] }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const { data } = await supabase()
    .from('whatsapp_contacts')
    .select('id, name, phone, instance_name, last_message_at, last_message_body, remote_jid, unread_count, profile_pic_url, follow_up')
    .in('instance_name', instanceNames)
    .not('phone', 'like', '%@lid')
    .not('phone', 'eq', 'status@broadcast')
    .order('last_message_at', { ascending: false })
    .limit(500)

  return NextResponse.json({ contacts: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
