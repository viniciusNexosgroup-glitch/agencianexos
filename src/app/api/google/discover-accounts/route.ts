import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { GoogleAdsApi } = await import('google-ads-api')
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })

    // Lista todos os customer IDs acessíveis pelo refresh token
    const resourceNames = await client.listAccessibleCustomers(
      process.env.GOOGLE_ADS_REFRESH_TOKEN!
    )

    const customerIds = resourceNames.map((rn: string) => rn.replace('customers/', ''))

    // Busca nome e tipo de cada conta
    const accounts = await Promise.all(customerIds.map(async (id: string) => {
      try {
        const customer = client.Customer({
          customer_id: id,
          refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
        })
        const [row] = await customer.query(
          `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer LIMIT 1`
        ) as any[]

        return {
          customer_id: id,
          name: row?.customer?.descriptive_name || id,
          currency: row?.customer?.currency_code || 'BRL',
          is_manager: row?.customer?.manager === true,
        }
      } catch {
        return { customer_id: id, name: id, currency: 'BRL', is_manager: false }
      }
    }))

    // Salva apenas contas folha (não gerenciadoras) no banco
    const leafAccounts = accounts.filter(a => !a.is_manager)

    if (leafAccounts.length > 0) {
      await supabase.from('google_accounts').upsert(
        leafAccounts.map(a => ({
          customer_id: a.customer_id,
          name: a.name,
          currency: a.currency,
          is_active: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: 'customer_id' }
      )
    }

    return NextResponse.json({
      ok: true,
      total: leafAccounts.length,
      accounts: leafAccounts.map(a => ({ customer_id: a.customer_id, name: a.name })),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
