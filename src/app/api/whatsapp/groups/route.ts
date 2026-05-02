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

  // Busca qualquer instância do usuário (conectada ou não — Evolution retorna vazio se offline)
  const { data: instances } = await supabase
    .from('whatsapp_instances')
    .select('instance_name, status')
    .eq('created_by', session.email)
    .limit(5)

  if (!instances || instances.length === 0) {
    return NextResponse.json({ error: 'Nenhuma instância encontrada', groups: [] })
  }

  // Tenta cada instância até encontrar uma com grupos
  for (const inst of instances) {
    const groups = await fetchAllGroups(inst.instance_name)
    if (groups.length > 0) {
      return NextResponse.json({ groups, instanceName: inst.instance_name })
    }
  }

  // Nenhuma instância retornou grupos — retorna vazio com a primeira
  const instanceName = instances[0].instance_name
  return NextResponse.json({ groups: [], instanceName })
}
