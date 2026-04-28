import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import axios from 'axios'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session || !session.is_admin) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`
  const TOKEN = process.env.META_ACCESS_TOKEN!

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: accounts } = await supabase
    .from('client_accounts')
    .select('ad_account_id')
    .eq('is_active', true)
    .limit(1)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ error: 'Nenhuma conta ativa' })
  }

  const adAccountId = accounts[0].ad_account_id
  const to = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  try {
    const resp = await axios.get(`${BASE}/${adAccountId}/insights`, {
      params: {
        access_token: TOKEN,
        fields: 'ad_id,ad_name,campaign_name,actions,action_values',
        level: 'ad',
        time_range: JSON.stringify({ since: from, until: to }),
        time_increment: 'all',
        limit: '10',
      },
    })

    const items = resp.data.data || []
    const result = items.map((item: any) => ({
      ad_id: item.ad_id,
      ad_name: item.ad_name,
      campaign_name: item.campaign_name,
      actions: item.actions || [],
    }))

    return NextResponse.json({ from, to, ads: result })
  } catch (err: any) {
    return NextResponse.json({ error: err.response?.data?.error?.message || err.message }, { status: 500 })
  }
}
