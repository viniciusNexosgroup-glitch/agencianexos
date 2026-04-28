import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { fetchAllGroups } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Busca a instância conectada do usuário
  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select('instance_name')
    .eq('created_by', session.email)
    .eq('status', 'connected')
    .limit(1)

  if (!instances || instances.length === 0) {
    return NextResponse.json({ error: 'Nenhuma instância conectada', groups: [] })
  }

  const instanceName = instances[0].instance_name
  const groups = await fetchAllGroups(instanceName)

  return NextResponse.json({ groups, instanceName })
}
