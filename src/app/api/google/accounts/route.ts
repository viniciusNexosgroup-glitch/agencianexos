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

  // Busca customer_ids distintos já sincronizados no banco
  const { data } = await supabase
    .from('google_campaign_metrics')
    .select('customer_id')
    .limit(500)

  if (!data || data.length === 0) {
    return NextResponse.json({ accounts: [] })
  }

  const ids = [...new Set(data.map(r => r.customer_id as string))]

  // Busca o nome de cada conta via Google Ads API
  try {
    const { GoogleAdsApi } = await import('google-ads-api')
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })

    const accounts = await Promise.all(ids.map(async (id) => {
      try {
        const customer = client.Customer({
          customer_id: id,
          refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        })
        const [row] = await customer.query(
          `SELECT customer.id, customer.descriptive_name FROM customer LIMIT 1`
        )
        return {
          customer_id: id,
          name: (row as any)?.customer?.descriptive_name || id,
        }
      } catch {
        return { customer_id: id, name: id }
      }
    }))

    return NextResponse.json({ accounts })
  } catch {
    // Fallback: retorna apenas os IDs sem nome
    return NextResponse.json({ accounts: ids.map(id => ({ customer_id: id, name: id })) })
  }
}
