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

  // Média de gasto diário dos últimos 7 dias por conta
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: metrics } = await db
    .from('campaign_metrics')
    .select('ad_account_id, spend, metric_date')
    .gte('metric_date', sevenDaysAgo)
    .lte('metric_date', today)

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const spendByAccount: Record<string, { total: number; days: Set<string>; yesterdaySpend: number }> = {}
  for (const m of metrics || []) {
    if (!spendByAccount[m.ad_account_id]) {
      spendByAccount[m.ad_account_id] = { total: 0, days: new Set(), yesterdaySpend: 0 }
    }
    spendByAccount[m.ad_account_id].total += Number(m.spend)
    spendByAccount[m.ad_account_id].days.add(m.metric_date)
    if (m.metric_date === yesterday) {
      spendByAccount[m.ad_account_id].yesterdaySpend += Number(m.spend)
    }
  }

  const debug = req.nextUrl.searchParams.get('debug') === '1'
  const alerts: { name: string; balance: number; daysLeft: number | null }[] = []
  const debugRows: { id: string; name: string; is_prepay: any; balance_raw: any }[] = []

  for (const account of accounts) {
    try {
      const res = await fetch(
        `https://graph.facebook.com/${version}/${account.ad_account_id}?fields=balance,is_prepay_account&access_token=${token}&_=${Date.now()}`,
        { signal: AbortSignal.timeout(10000), cache: 'no-store' }
      )
      const data = await res.json()
      if (debug) debugRows.push({ id: account.ad_account_id, name: account.account_name, is_prepay: data.is_prepay_account, balance_raw: data.balance })
      if (data.error || data.balance == null) continue
      if (!data.is_prepay_account) continue // pula contas pós-pagas

      const balance = Number(data.balance) / 100

      if (balance < THRESHOLD) {
        const spendData = spendByAccount[account.ad_account_id]
        // Busca gasto de hoje e ontem direto da Meta Insights (dados do dia)
        try {
          const insightsRes = await fetch(
            `https://graph.facebook.com/${version}/${account.ad_account_id}/insights?fields=spend&time_range={"since":"${yesterday}","until":"${today}"}&access_token=${token}&_=${Date.now()}`,
            { signal: AbortSignal.timeout(8000), cache: 'no-store' }
          )
          const insightsData = await insightsRes.json()
          const recentSpend = (insightsData?.data || []).reduce((sum: number, d: any) => sum + Number(d.spend || 0), 0)
          if (recentSpend > balance) continue // saldo da API desatualizado — conta tem fundos
        } catch { /* ignora erro de insights, continua com alerta */ }
        const avgDaily = spendData && spendData.days.size > 0
          ? spendData.total / spendData.days.size
          : 0
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
