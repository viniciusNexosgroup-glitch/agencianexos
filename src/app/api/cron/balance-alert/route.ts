import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabase()
  const token = process.env.META_ACCESS_TOKEN!
  const version = process.env.META_API_VERSION || 'v21.0'
  const THRESHOLD = 30

  const { data: accounts } = await db
    .from('client_accounts')
    .select('ad_account_id, account_name')
    .eq('is_active', true)
    .not('account_name', 'is', null)

  if (!accounts?.length) return NextResponse.json({ ok: true, checked: 0 })

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const ts = Date.now()

  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const alerts: { name: string; balance: number; daysLeft: number | null }[] = []
  const debugRows: { id: string; name: string; is_prepay: any; balance_raw: any; recent_spend?: number }[] = []

  for (const account of accounts) {
    try {
      // Busca saldo e tipo de conta direto da Meta API
      const res = await fetch(
        `https://graph.facebook.com/${version}/${account.ad_account_id}?fields=balance,is_prepay_account&access_token=${token}&_=${ts}`,
        { signal: AbortSignal.timeout(10000), cache: 'no-store' }
      )
      const data = await res.json()
      if (data.error || data.balance == null) continue
      if (!data.is_prepay_account) continue

      const balance = Number(data.balance) / 100

      if (balance < THRESHOLD) {
        // Busca gasto dos últimos 7 dias direto da Meta Insights API
        let avgDaily = 0
        let recentSpend = 0
        try {
          const insightsRes = await fetch(
            `https://graph.facebook.com/${version}/${account.ad_account_id}/insights?fields=spend&time_range={"since":"${sevenDaysAgo}","until":"${today}"}&time_increment=1&access_token=${token}&_=${ts}`,
            { signal: AbortSignal.timeout(10000), cache: 'no-store' }
          )
          const insightsData = await insightsRes.json()
          const rows: any[] = insightsData?.data || []
          recentSpend = rows.reduce((sum, d) => sum + Number(d.spend || 0), 0)
          if (rows.length > 0) avgDaily = recentSpend / rows.length
          // Se gastou mais nos últimos 2 dias do que o saldo reportado → saldo desatualizado
          const last2 = rows.slice(-2).reduce((sum, d) => sum + Number(d.spend || 0), 0)
          if (last2 > balance) {
            if (debug) debugRows.push({ id: account.ad_account_id, name: account.account_name, is_prepay: data.is_prepay_account, balance_raw: data.balance, recent_spend: last2 })
            continue
          }
        } catch { /* sem insights, usa balance mesmo */ }

        if (debug) debugRows.push({ id: account.ad_account_id, name: account.account_name, is_prepay: data.is_prepay_account, balance_raw: data.balance, recent_spend: recentSpend })
        const daysLeft = avgDaily > 0 ? Math.floor(balance / avgDaily) : null
        alerts.push({ name: account.account_name, balance, daysLeft })
      }
    } catch { /* pula conta com erro */ }
  }

  if (debug) return NextResponse.json({ debug: debugRows })

  if (alerts.length === 0) {
    return NextResponse.json({ ok: true, alerts: 0 })
  }

  const lines = alerts
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { numeric: true }))
    .map(a => {
      const dias = a.daysLeft !== null
        ? `~${a.daysLeft} dia${a.daysLeft !== 1 ? 's' : ''}`
        : 'gasto variável'
      return `• ${a.name}\n  Saldo: R$ ${a.balance.toFixed(2).replace('.', ',')} (${dias})`
    })
    .join('\n')

  const dateStr = new Date().toLocaleDateString('pt-BR')
  const message = `⚠️ *Saldo baixo — ${dateStr}*\n\n${lines}\n\n_Contas com menos de R$ 30,00_`

  const phone = process.env.ALERT_WHATSAPP_NUMBER || '5534991438706'
  const instanceName = 'vamo'

  await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({ number: phone, text: message }),
  })

  return NextResponse.json({ ok: true, alerts: alerts.length })
}
