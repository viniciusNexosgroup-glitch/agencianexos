export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { MetricCard } from '@/components/MetricCard'
import { SpendChart } from '@/components/SpendChart'
import { CampaignTable } from '@/components/CampaignTable'
import { CreativeGrid } from '@/components/CreativeGrid'
import { GoogleCampaignTable } from '@/components/GoogleCampaignTable'
import { DateRangePicker } from '@/components/DateRangePicker'
import { DashboardTabs } from '@/components/DashboardTabs'

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string; tab?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const tab = params.tab === 'google' ? 'google' : 'meta'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: client } = await supabase
    .from('clients')
    .select('name, is_admin')
    .eq('id', session.sub)
    .single()

  const from = params.from || daysAgo(30)
  const to = params.to || new Date().toISOString().split('T')[0]

  // ── GOOGLE ADS ──────────────────────────────────────────────────
  if (tab === 'google') {
    const { data: gMetrics } = await supabase
      .from('google_campaign_metrics')
      .select('*')
      .gte('metric_date', from)
      .lte('metric_date', to)
      .order('metric_date', { ascending: true })

    const gRows = gMetrics || []

    const gTotals = gRows.reduce(
      (acc, m) => ({
        spend: acc.spend + Number(m.spend),
        impressions: acc.impressions + Number(m.impressions),
        clicks: acc.clicks + Number(m.clicks),
        conversions: acc.conversions + Number(m.conversions),
        conversion_value: acc.conversion_value + Number(m.conversion_value),
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0 }
    )

    const gCtr = gTotals.impressions > 0 ? (gTotals.clicks / gTotals.impressions) : 0
    const gCpc = gTotals.clicks > 0 ? gTotals.spend / gTotals.clicks : 0
    const gRoas = gTotals.spend > 0 ? gTotals.conversion_value / gTotals.spend : 0

    const gSpendByDay: Record<string, number> = {}
    for (const m of gRows) {
      gSpendByDay[m.metric_date] = (gSpendByDay[m.metric_date] || 0) + Number(m.spend)
    }
    const gChartData = Object.entries(gSpendByDay)
      .map(([date, spend]) => ({ date: date.substring(5), spend: Number(spend.toFixed(2)) }))

    const gCampaignMap: Record<string, any> = {}
    for (const m of gRows) {
      const k = m.campaign_id
      if (!gCampaignMap[k]) {
        gCampaignMap[k] = {
          campaign_id: k, campaign_name: m.campaign_name,
          spend: 0, impressions: 0, clicks: 0, conversions: 0, conversion_value: 0,
        }
      }
      gCampaignMap[k].spend += Number(m.spend)
      gCampaignMap[k].impressions += Number(m.impressions)
      gCampaignMap[k].clicks += Number(m.clicks)
      gCampaignMap[k].conversions += Number(m.conversions)
      gCampaignMap[k].conversion_value += Number(m.conversion_value)
    }
    const gCampaignRows = Object.values(gCampaignMap).map(c => ({
      ...c,
      ctr: c.impressions > 0 ? c.clicks / c.impressions : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : null,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
      roas: c.spend > 0 ? c.conversion_value / c.spend : 0,
    })).sort((a, b) => b.spend - a.spend)

    return (
      <div className="flex-1">
        <main className="px-6 py-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <DashboardTabs active="google" />
              <h2 className="text-white text-xl font-semibold">Google Ads — Conta {process.env.GOOGLE_ADS_CUSTOMER_ID}</h2>
            </div>
            <DateRangePicker defaultFrom={from} defaultTo={to} accounts={[]} selectedAccount="" />
          </div>

          {gRows.length === 0 ? (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-slate-400">Nenhum dado encontrado. Execute o sync do Google Ads.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard label="Gasto Total" value={`R$ ${fmt(gTotals.spend)}`} icon="💰" color="indigo" />
                <MetricCard label="ROAS" value={gRoas > 0 ? `${gRoas.toFixed(2)}x` : '—'} icon="📈" color={gRoas >= 3 ? 'green' : gRoas > 0 ? 'yellow' : 'slate'} />
                <MetricCard label="CTR" value={`${(gCtr * 100).toFixed(2)}%`} icon="🖱️" color={gCtr >= 0.05 ? 'green' : gCtr >= 0.02 ? 'yellow' : 'red'} />
                <MetricCard label="CPC Médio" value={gCpc > 0 ? `R$ ${fmt(gCpc)}` : '—'} icon="🎯" color="slate" />
                <MetricCard label="Impressões" value={fmtInt(gTotals.impressions)} icon="👁️" color="slate" />
                <MetricCard label="Cliques" value={fmtInt(gTotals.clicks)} icon="👆" color="slate" />
                <MetricCard label="Conversões" value={fmt(gTotals.conversions)} icon="✅" color={gTotals.conversions > 0 ? 'green' : 'slate'} />
                <MetricCard label="Valor Conv." value={`R$ ${fmt(gTotals.conversion_value)}`} icon="💵" color={gTotals.conversion_value > 0 ? 'green' : 'slate'} />
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-1">Gasto diário</h3>
                <p className="text-slate-400 text-sm mb-6">{from} → {to}</p>
                <SpendChart data={gChartData} />
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-6">Campanhas ({gCampaignRows.length})</h3>
                <GoogleCampaignTable rows={gCampaignRows} />
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  // ── META ADS ────────────────────────────────────────────────────
  const { data: accounts } = await supabase
    .from('client_accounts')
    .select('ad_account_id, account_name, bm_name')
    .eq('is_active', true)

  const allAccounts = accounts || []
  const selectedAccountId = params.account || allAccounts[0]?.ad_account_id || ''
  const accountIds = client?.is_admin
    ? allAccounts.map(a => a.ad_account_id)
    : [selectedAccountId]

  const { data: metrics } = await supabase
    .from('campaign_metrics')
    .select('*')
    .in('ad_account_id', accountIds)
    .gte('metric_date', from)
    .lte('metric_date', to)
    .order('metric_date', { ascending: true })

  const rows = metrics || []

  const totals = rows.reduce(
    (acc, m) => ({
      spend: acc.spend + Number(m.spend),
      impressions: acc.impressions + Number(m.impressions),
      clicks: acc.clicks + Number(m.clicks),
      purchases: acc.purchases + Number(m.purchases),
      purchase_value: acc.purchase_value + Number(m.purchase_value),
      leads: acc.leads + Number(m.leads),
      checkouts: acc.checkouts + Number(m.checkouts),
    }),
    { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0, leads: 0, checkouts: 0 }
  )

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0
  const roas = totals.spend > 0 ? totals.purchase_value / totals.spend : 0

  const spendByDay: Record<string, number> = {}
  for (const m of rows) {
    spendByDay[m.metric_date] = (spendByDay[m.metric_date] || 0) + Number(m.spend)
  }
  const spendChartData = Object.entries(spendByDay)
    .map(([date, spend]) => ({ date: date.substring(5), spend: Number(spend.toFixed(2)) }))

  const campaignMap: Record<string, any> = {}
  for (const m of rows) {
    const k = m.campaign_id
    if (!campaignMap[k]) {
      campaignMap[k] = {
        campaign_id: k, campaign_name: m.campaign_name,
        spend: 0, impressions: 0, clicks: 0,
        purchases: 0, purchase_value: 0, leads: 0, checkouts: 0, frequency_sum: 0, days: 0,
      }
    }
    campaignMap[k].spend += Number(m.spend)
    campaignMap[k].impressions += Number(m.impressions)
    campaignMap[k].clicks += Number(m.clicks)
    campaignMap[k].purchases += Number(m.purchases)
    campaignMap[k].purchase_value += Number(m.purchase_value)
    campaignMap[k].leads += Number(m.leads)
    campaignMap[k].checkouts += Number(m.checkouts)
    campaignMap[k].frequency_sum += Number(m.frequency)
    campaignMap[k].days += 1
  }

  const campaignRows = Object.values(campaignMap).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    cpc: c.clicks > 0 ? c.spend / c.clicks : null,
    cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : null,
    roas: c.spend > 0 ? c.purchase_value / c.spend : 0,
    frequency: c.days > 0 ? c.frequency_sum / c.days : 0,
  })).sort((a, b) => b.spend - a.spend)

  // Ad-level metrics (creatives)
  const { data: adMetrics } = await supabase
    .from('ad_metrics')
    .select('ad_id, ad_name, campaign_name, adset_name, thumbnail_url, effective_status, metric_date, impressions, reach, clicks, spend, ctr, cpc, cpm, purchases, purchase_value, leads, checkouts, frequency')
    .in('ad_account_id', accountIds)
    .gte('metric_date', from)
    .lte('metric_date', to)

  const adMap: Record<string, any> = {}
  for (const m of adMetrics || []) {
    const k = m.ad_id
    if (!adMap[k]) {
      adMap[k] = {
        ad_id: k, ad_name: m.ad_name, campaign_name: m.campaign_name,
        adset_name: m.adset_name, thumbnail_url: m.thumbnail_url,
        effective_status: m.effective_status, last_date: m.metric_date,
        spend: 0, impressions: 0, clicks: 0, purchases: 0, purchase_value: 0, leads: 0,
      }
    }
    adMap[k].spend += Number(m.spend)
    adMap[k].impressions += Number(m.impressions)
    adMap[k].clicks += Number(m.clicks)
    adMap[k].purchases += Number(m.purchases)
    adMap[k].purchase_value += Number(m.purchase_value)
    adMap[k].leads += Number(m.leads)
    if (m.metric_date >= adMap[k].last_date) {
      adMap[k].last_date = m.metric_date
      if (m.thumbnail_url) adMap[k].thumbnail_url = m.thumbnail_url
      if (m.effective_status) adMap[k].effective_status = m.effective_status
    }
  }
  const creativeRows = Object.values(adMap)
    .filter(a => a.spend > 0)
    .map(a => ({
      ...a,
      ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      cpc: a.clicks > 0 ? a.spend / a.clicks : null,
      cpm: a.impressions > 0 ? (a.spend / a.impressions) * 1000 : null,
      roas: a.spend > 0 ? a.purchase_value / a.spend : 0,
    }))
    .sort((a, b) => b.spend - a.spend)

  const { data: lastSync } = await supabase
    .from('sync_logs')
    .select('created_at')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const selectedAccount = allAccounts.find(a => a.ad_account_id === selectedAccountId)

  return (
    <div className="flex-1">
      <main className="px-6 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-3">
            <DashboardTabs active="meta" />
            <div>
              <h2 className="text-white text-xl font-semibold">
                {selectedAccount?.account_name || selectedAccountId}
              </h2>
              {selectedAccount?.bm_name && (
                <p className="text-slate-400 text-sm">BM: {selectedAccount.bm_name}</p>
              )}
            </div>
          </div>
          <DateRangePicker
            defaultFrom={from}
            defaultTo={to}
            accounts={allAccounts}
            selectedAccount={selectedAccountId}
          />
        </div>

        {rows.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400">Nenhum dado encontrado para o período selecionado.</p>
            <p className="text-slate-500 text-sm mt-2">Verifique se o sync foi executado ou altere o período.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Gasto Total" value={`R$ ${fmt(totals.spend)}`} icon="💰" color="indigo" />
              <MetricCard label="ROAS" value={roas > 0 ? `${roas.toFixed(2)}x` : '—'} icon="📈" color={roas >= 3 ? 'green' : roas > 0 ? 'yellow' : 'slate'} />
              <MetricCard label="CTR" value={`${ctr.toFixed(2)}%`} icon="🖱️" color={ctr >= 2 ? 'green' : ctr >= 1 ? 'yellow' : 'red'} />
              <MetricCard label="CPC Médio" value={cpc > 0 ? `R$ ${fmt(cpc)}` : '—'} icon="🎯" color="slate" />
              <MetricCard label="Impressões" value={fmtInt(totals.impressions)} icon="👁️" color="slate" />
              <MetricCard label="Cliques" value={fmtInt(totals.clicks)} icon="👆" color="slate" />
              <MetricCard label="Vendas" value={fmtInt(totals.purchases)} icon="🛒" color={totals.purchases > 0 ? 'green' : 'slate'} />
              <MetricCard label="Leads" value={fmtInt(totals.leads)} icon="📋" color={totals.leads > 0 ? 'green' : 'slate'} />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Criativos</h3>
              <p className="text-slate-400 text-sm mb-6">{from} → {to}</p>
              <CreativeGrid creatives={creativeRows} from={from} to={to} />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-6">Campanhas ({campaignRows.length})</h3>
              <CampaignTable rows={campaignRows} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
