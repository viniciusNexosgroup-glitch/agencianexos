export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { MetricCard } from '@/components/MetricCard'
import { BalanceCard } from '@/components/BalanceCard'
import { SpendChart } from '@/components/SpendChart'
import { CampaignTable } from '@/components/CampaignTable'
import { CreativeGrid } from '@/components/CreativeGrid'
import { CreativeToolbar } from '@/components/CreativeToolbar'
import { GoogleCampaignTable } from '@/components/GoogleCampaignTable'
import { GoogleKeywordTable } from '@/components/GoogleKeywordTable'
import { ExportPdfButton } from '@/components/ExportPdfButton'
import { SendReportButton } from '@/components/SendReportButton'
import { LinkGoogleButton } from '@/components/LinkGoogleButton'
import { DiscoverAccountsButton } from '@/components/DiscoverAccountsButton'
import { DateRangePicker } from '@/components/DateRangePicker'
import { DashboardTabs } from '@/components/DashboardTabs'
import { DiscoverGoogleAccountsButton } from '@/components/DiscoverGoogleAccountsButton'

function fmt(n: number) { return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtInt(n: number) { return n.toLocaleString('pt-BR') }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; account?: string; tab?: string; creative_filter?: string }>
}) {
  const params = await searchParams
  const session = await getSession()
  if (!session) redirect('/login')

  const tab = params.tab === 'google' ? 'google' : 'meta'
  const creativeFilter = params.creative_filter === 'all' ? 'all' : 'active'

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

  if (!client?.is_admin) redirect('/dashboard/crm')

  const from = params.from || daysAgo(30)
  const to = params.to || new Date().toISOString().split('T')[0]

  // ── CONTAS (compartilhado entre abas) ───────────────────────────
  const { data: accounts } = await supabase
    .from('client_accounts')
    .select('ad_account_id, account_name, bm_name, report_group_jid, google_customer_id')
    .eq('is_active', true)

  const allAccounts = (accounts || []).sort((a, b) =>
    (a.account_name || '').localeCompare(b.account_name || '', 'pt-BR', { numeric: true, sensitivity: 'base' })
  )
  const selectedAccountId = params.account || allAccounts[0]?.ad_account_id || ''
  const selectedAccount = allAccounts.find(a => a.ad_account_id === selectedAccountId)

  // ── GOOGLE ADS ──────────────────────────────────────────────────
  if (tab === 'google') {
    // Busca customer IDs distintos do Google
    const { data: gCustomerRows } = await supabase
      .from('google_campaign_metrics')
      .select('customer_id')
      .limit(500)

    const googleCustomerIds = [...new Set((gCustomerRows || []).map(r => r.customer_id as string))]
    const selectedGoogleCustomerId = googleCustomerIds.includes(params.account || '')
      ? params.account || ''
      : googleCustomerIds[0] || ''

    const googleAccountsList = googleCustomerIds.map(id => ({
      ad_account_id: id,
      account_name: id.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3'),
      bm_name: null as string | null,
      report_group_jid: null as string | null,
      google_customer_id: null as string | null,
    }))

    const [{ data: gMetrics }, { data: kwMetrics }, { data: stMetrics }] = await Promise.all([
      (selectedGoogleCustomerId
        ? supabase.from('google_campaign_metrics').select('*').gte('metric_date', from).lte('metric_date', to).eq('customer_id', selectedGoogleCustomerId).order('metric_date', { ascending: true })
        : supabase.from('google_campaign_metrics').select('*').gte('metric_date', from).lte('metric_date', to).order('metric_date', { ascending: true })
      ),
      (selectedGoogleCustomerId
        ? supabase.from('google_keyword_metrics').select('keyword, match_type, campaign_name, ad_group_name, impressions, clicks, spend, conversions, ctr').gte('metric_date', from).lte('metric_date', to).eq('customer_id', selectedGoogleCustomerId)
        : supabase.from('google_keyword_metrics').select('keyword, match_type, campaign_name, ad_group_name, impressions, clicks, spend, conversions, ctr').gte('metric_date', from).lte('metric_date', to)
      ),
      (selectedGoogleCustomerId
        ? supabase.from('google_search_term_metrics').select('search_term, campaign_name, ad_group_name, impressions, clicks, spend, conversions, ctr').gte('metric_date', from).lte('metric_date', to).eq('customer_id', selectedGoogleCustomerId)
        : supabase.from('google_search_term_metrics').select('search_term, campaign_name, ad_group_name, impressions, clicks, spend, conversions, ctr').gte('metric_date', from).lte('metric_date', to)
      ),
    ])

    const gRows = gMetrics || []

    const gTotals = gRows.reduce(
      (acc, m) => ({
        spend: acc.spend + Number(m.spend),
        impressions: acc.impressions + Number(m.impressions),
        clicks: acc.clicks + Number(m.clicks),
        conversions: acc.conversions + Number(m.conversions),
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    )

    const gCtr = gTotals.impressions > 0 ? (gTotals.clicks / gTotals.impressions) * 100 : 0
    const gCustoResultado = gTotals.conversions > 0 ? gTotals.spend / gTotals.conversions : null

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

    // Aggregate keywords
    const kwMap: Record<string, any> = {}
    for (const m of kwMetrics || []) {
      const k = `${m.keyword}__${m.match_type}__${m.campaign_name}`
      if (!kwMap[k]) {
        kwMap[k] = {
          term: m.keyword, type: 'keyword' as const,
          match_type: m.match_type, campaign_name: m.campaign_name,
          ad_group_name: m.ad_group_name,
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
        }
      }
      kwMap[k].spend += Number(m.spend)
      kwMap[k].impressions += Number(m.impressions)
      kwMap[k].clicks += Number(m.clicks)
      kwMap[k].conversions += Number(m.conversions)
    }
    const kwRows = Object.values(kwMap).map(r => ({
      ...r,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    })).sort((a, b) => b.spend - a.spend)

    // Aggregate search terms
    const stMap: Record<string, any> = {}
    for (const m of stMetrics || []) {
      const k = `${m.search_term}__${m.campaign_name}`
      if (!stMap[k]) {
        stMap[k] = {
          term: m.search_term, type: 'search_term' as const,
          campaign_name: m.campaign_name, ad_group_name: m.ad_group_name,
          spend: 0, impressions: 0, clicks: 0, conversions: 0,
        }
      }
      stMap[k].spend += Number(m.spend)
      stMap[k].impressions += Number(m.impressions)
      stMap[k].clicks += Number(m.clicks)
      stMap[k].conversions += Number(m.conversions)
    }
    const stRows = Object.values(stMap).map(r => ({
      ...r,
      ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
    })).sort((a, b) => b.spend - a.spend)

    return (
      <div className="flex-1">
        <main className="px-6 py-8 space-y-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <DashboardTabs active="google" />
              <h2 className="text-white text-xl font-semibold">
                Google Ads{selectedGoogleCustomerId ? ` — ${selectedGoogleCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}` : ''}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <DiscoverGoogleAccountsButton />
              <ExportPdfButton from={from} to={to} adAccountId={selectedGoogleCustomerId} accountName={selectedGoogleCustomerId ? selectedGoogleCustomerId.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') : undefined} />
              <DateRangePicker defaultFrom={from} defaultTo={to} accounts={googleAccountsList} selectedAccount={selectedGoogleCustomerId} />
            </div>
          </div>

          {gRows.length === 0 ? (
            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center">
              <p className="text-slate-400">Nenhum dado encontrado. Execute o sync do Google Ads.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <MetricCard label="Valor Usado" value={`R$ ${fmt(gTotals.spend)}`} icon="💰" color="indigo" />
                <MetricCard label="Impressões" value={fmtInt(gTotals.impressions)} icon="👁️" color="slate" />
                <MetricCard label="Resultado" value={fmt(gTotals.conversions)} icon="✅" color={gTotals.conversions > 0 ? 'green' : 'slate'} />
                <MetricCard label="Custo/Resultado" value={gCustoResultado ? `R$ ${fmt(gCustoResultado)}` : '—'} icon="🎯" color="slate" />
                <MetricCard label="Cliques" value={fmtInt(gTotals.clicks)} icon="👆" color="slate" />
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-6">Campanhas ({gCampaignRows.length})</h3>
                <GoogleCampaignTable rows={gCampaignRows} />
              </div>

              <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-6">Palavras-chave e Termos de Pesquisa</h3>
                <GoogleKeywordTable keywords={kwRows} searchTerms={stRows} />
              </div>
            </>
          )}
        </main>
      </div>
    )
  }

  // ── META ADS ────────────────────────────────────────────────────
  const accountIds = [selectedAccountId].filter(Boolean)

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
      reach: acc.reach + Number(m.reach),
      clicks: acc.clicks + Number(m.clicks),
      purchases: acc.purchases + Number(m.purchases),
      purchase_value: acc.purchase_value + Number(m.purchase_value),
      leads: acc.leads + Number(m.leads),
      checkouts: acc.checkouts + Number(m.checkouts),
      conversations: acc.conversations + Number((m as Record<string, any>).conversations || 0),
      profile_visits: acc.profile_visits + Number((m as Record<string, any>).profile_visits || 0),
    }),
    { spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchase_value: 0, leads: 0, checkouts: 0, conversations: 0, profile_visits: 0 }
  )

  const periodDays = Math.max(1, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)) + 1)
  const avgDailySpend = totals.spend / periodDays

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0
  // Prioridade: conversas > leads > compras > visitas ao perfil
  const resultado = totals.conversations > 0 ? totals.conversations
    : totals.leads > 0 ? totals.leads
    : totals.purchases > 0 ? totals.purchases
    : totals.profile_visits
  const custoResultado = resultado > 0 ? totals.spend / resultado : null

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
        spend: 0, impressions: 0, reach: 0, clicks: 0,
        purchases: 0, purchase_value: 0, leads: 0, checkouts: 0,
        conversations: 0, profile_visits: 0, frequency_sum: 0, days: 0,
      }
    }
    campaignMap[k].spend += Number(m.spend)
    campaignMap[k].impressions += Number(m.impressions)
    campaignMap[k].reach += Number(m.reach)
    campaignMap[k].clicks += Number(m.clicks)
    campaignMap[k].purchases += Number(m.purchases)
    campaignMap[k].purchase_value += Number(m.purchase_value)
    campaignMap[k].leads += Number(m.leads)
    campaignMap[k].checkouts += Number(m.checkouts)
    campaignMap[k].conversations += Number((m as Record<string, any>).conversations || 0)
    campaignMap[k].profile_visits += Number((m as Record<string, any>).profile_visits || 0)
    campaignMap[k].frequency_sum += Number(m.frequency)
    campaignMap[k].days += 1
  }

  const campaignRows = Object.values(campaignMap).map(c => {
    const resultado = c.conversations > 0 ? c.conversations
      : c.leads > 0 ? c.leads
      : c.purchases > 0 ? c.purchases
      : c.profile_visits
    return {
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      frequency: c.days > 0 ? c.frequency_sum / c.days : 0,
      resultado,
      custo_resultado: resultado > 0 ? c.spend / resultado : null,
    }
  }).sort((a, b) => b.spend - a.spend)

  // Ad-level metrics (creatives)
  const { data: adMetrics } = await supabase
    .from('ad_metrics')
    .select('ad_id, ad_name, campaign_name, adset_name, thumbnail_url, effective_status, metric_date, impressions, reach, clicks, spend, ctr, cpc, cpm, purchases, purchase_value, leads, checkouts, conversations, profile_visits, frequency')
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
        spend: 0, impressions: 0, reach: 0, clicks: 0, purchases: 0, purchase_value: 0, leads: 0,
        conversations: 0, profile_visits: 0, frequency_sum: 0, days: 0,
      }
    }
    adMap[k].spend += Number(m.spend)
    adMap[k].impressions += Number(m.impressions)
    adMap[k].reach += Number(m.reach)
    adMap[k].clicks += Number(m.clicks)
    adMap[k].purchases += Number(m.purchases)
    adMap[k].purchase_value += Number(m.purchase_value)
    adMap[k].leads += Number(m.leads)
    adMap[k].conversations += Number(m.conversations || 0)
    adMap[k].profile_visits += Number(m.profile_visits || 0)
    adMap[k].frequency_sum += Number(m.frequency)
    adMap[k].days += 1
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
      frequency: a.days > 0 ? a.frequency_sum / a.days : 0,
    }))
    .sort((a, b) => b.spend - a.spend)

  const { data: lastSync } = await supabase
    .from('sync_logs')
    .select('created_at')
    .eq('status', 'success')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

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
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <DiscoverAccountsButton compact />
              <LinkGoogleButton
                key={selectedAccountId}
                adAccountId={selectedAccountId}
                linkedCustomerId={selectedAccount?.google_customer_id}
              />
              <SendReportButton
                from={from}
                to={to}
                adAccountId={selectedAccountId}
                accountName={selectedAccount?.account_name || selectedAccountId}
                linkedGroupJid={selectedAccount?.report_group_jid}
                googleCustomerId={selectedAccount?.google_customer_id}
              />
              <ExportPdfButton
                from={from}
                to={to}
                adAccountId={selectedAccountId}
                accountName={selectedAccount?.account_name || selectedAccountId}
                googleCustomerId={selectedAccount?.google_customer_id}
              />
              <DateRangePicker
                defaultFrom={from}
                defaultTo={to}
                accounts={allAccounts}
                selectedAccount={selectedAccountId}
              />
            </div>
            <CreativeToolbar from={from} to={to} activeFilter={creativeFilter} accountId={selectedAccountId} />
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-12 text-center">
            <p className="text-slate-400">Nenhum dado encontrado para o período selecionado.</p>
            <p className="text-slate-500 text-sm mt-2">Verifique se o sync foi executado ou altere o período.</p>
          </div>
        ) : (
          <>
            <BalanceCard accountId={selectedAccountId} avgDailySpend={avgDailySpend} />

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <MetricCard label="Valor Usado" value={`R$ ${fmt(totals.spend)}`} icon="💰" color="indigo" />
              <MetricCard label="Alcance" value={fmtInt(totals.reach)} icon="👥" color="slate" />
              <MetricCard label="Resultado" value={fmtInt(resultado)} icon="✅" color={resultado > 0 ? 'green' : 'slate'} />
              <MetricCard label="Custo por Result." value={custoResultado ? `R$ ${fmt(custoResultado)}` : '—'} icon="🎯" color="slate" />
              <MetricCard label="Cliques" value={fmtInt(totals.clicks)} icon="👆" color="slate" />
              <MetricCard label="CTR" value={`${ctr.toFixed(2)}%`} icon="🖱️" color={ctr >= 2 ? 'green' : ctr >= 1 ? 'yellow' : 'red'} />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-6">Campanhas ({campaignRows.length})</h3>
              <CampaignTable rows={campaignRows} />
            </div>

            <div className="bg-[#111827] border border-slate-800 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Criativos</h3>
              <p className="text-slate-400 text-sm mb-6">{from} → {to}</p>
              <CreativeGrid creatives={creativeFilter === 'active' ? creativeRows.filter(c => c.effective_status === 'ACTIVE') : creativeRows} />
            </div>
          </>
        )}
      </main>
    </div>
  )
}
