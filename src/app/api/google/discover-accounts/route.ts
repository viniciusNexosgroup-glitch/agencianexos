import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getGoogleRefreshToken } from '@/lib/get-google-token'

export const dynamic = 'force-dynamic'

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const refreshToken = await getGoogleRefreshToken()
  if (!refreshToken) {
    return NextResponse.json({ error: 'Google Ads não conectado. Use o botão "Conectar Google Ads".' }, { status: 400 })
  }

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

    const resourceNames = await client.listAccessibleCustomers(refreshToken)
    const customerIds = resourceNames.map((rn: string) => rn.replace('customers/', ''))

    const accounts = await Promise.all(customerIds.map(async (id: string) => {
      try {
        const customer = client.Customer({ customer_id: id, refresh_token: refreshToken })
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
    console.error('[discover-accounts] erro completo:', JSON.stringify(err, Object.getOwnPropertyNames(err)))
    const msg = err?.message
      || (Array.isArray(err?.errors) ? err.errors.map((e: any) => e?.message || JSON.stringify(e)).join('; ') : null)
      || JSON.stringify(err, Object.getOwnPropertyNames(err))
      || 'Erro desconhecido'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
