import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Primeiro tenta a tabela google_accounts (fonte mais rápida e com nomes)
  const { data: gaRows } = await supabase
    .from('google_accounts')
    .select('customer_id, name')
    .eq('is_active', true)
    .order('name')

  if (gaRows && gaRows.length > 0) {
    return NextResponse.json({ accounts: gaRows })
  }

  // Fallback: busca customer_ids distintos nos dados sincronizados
  const { data: metricsRows } = await supabase
    .from('google_campaign_metrics')
    .select('customer_id')
    .limit(500)

  if (!metricsRows || metricsRows.length === 0) {
    return NextResponse.json({ accounts: [] })
  }

  const ids = [...new Set(metricsRows.map(r => r.customer_id as string))]
  return NextResponse.json({ accounts: ids.map(id => ({ customer_id: id, name: id })) })
}
