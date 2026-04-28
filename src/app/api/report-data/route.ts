import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from') || ''
  const to = searchParams.get('to') || ''

  const db = supabase()

  const [{ data: metaMetrics }, { data: adMetrics }, { data: googleMetrics }, { data: kwMetrics }] = await Promise.all([
    db.from('campaign_metrics').select('*').gte('metric_date', from).lte('metric_date', to),
    db.from('ad_metrics')
      .select('ad_id,ad_name,campaign_name,impressions,reach,clicks,spend,ctr,purchases,leads,conversations,profile_visits,frequency')
      .gte('metric_date', from)
      .lte('metric_date', to),
    db.from('google_campaign_metrics').select('*').gte('metric_date', from).lte('metric_date', to),
    db.from('google_keyword_metrics')
      .select('keyword,match_type,campaign_name,impressions,clicks,spend,conversions')
      .gte('metric_date', from)
      .lte('metric_date', to),
  ])

  // Aggregate Meta campaigns
  const metaCampMap: Record<string, any> = {}
  for (const m of metaMetrics || []) {
    const k = m.campaign_id
    if (!metaCampMap[k]) {
      metaCampMap[k] = {
        campaign_name: m.campaign_name,
        spend: 0, reach: 0, clicks: 0, impressions: 0,
        conversations: 0, leads: 0, purchases: 0, profile_visits: 0,
      }
    }
    metaCampMap[k].spend += Number(m.spend)
    metaCampMap[k].reach += Number(m.reach)
    metaCampMap[k].clicks += Number(m.clicks)
    metaCampMap[k].impressions += Number(m.impressions)
    metaCampMap[k].conversations += Number((m as any).conversations || 0)
    metaCampMap[k].leads += Number(m.leads)
    metaCampMap[k].purchases += Number(m.purchases)
    metaCampMap[k].profile_visits += Number((m as any).profile_visits || 0)
  }
  const metaCampaigns = Object.values(metaCampMap).map(c => {
    const resultado = c.conversations > 0 ? c.conversations
      : c.leads > 0 ? c.leads
      : c.purchases > 0 ? c.purchases
      : c.profile_visits
    return {
      ...c,
      resultado,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      custo_resultado: resultado > 0 ? c.spend / resultado : null,
    }
  }).sort((a, b) => b.spend - a.spend)

  const metaTotals = metaCampaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      reach: acc.reach + c.reach,
      clicks: acc.clicks + c.clicks,
      impressions: acc.impressions + c.impressions,
      resultado: acc.resultado + c.resultado,
    }),
    { spend: 0, reach: 0, clicks: 0, impressions: 0, resultado: 0 }
  )
  const metaCtr = metaTotals.impressions > 0 ? (metaTotals.clicks / metaTotals.impressions) * 100 : 0
  const metaCustoResultado = metaTotals.resultado > 0 ? metaTotals.spend / metaTotals.resultado : null

  // Aggregate Google campaigns
  const gCampMap: Record<string, any> = {}
  for (const m of googleMetrics || []) {
    const k = m.campaign_id
    if (!gCampMap[k]) {
      gCampMap[k] = { campaign_name: m.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    }
    gCampMap[k].spend += Number(m.spend)
    gCampMap[k].impressions += Number(m.impressions)
    gCampMap[k].clicks += Number(m.clicks)
    gCampMap[k].conversions += Number(m.conversions)
  }
  const googleCampaigns = Object.values(gCampMap).map(c => ({
    ...c,
    ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
    custo_resultado: c.conversions > 0 ? c.spend / c.conversions : null,
  })).sort((a, b) => b.spend - a.spend)

  const googleTotals = googleCampaigns.reduce(
    (acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions,
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
  )
  const googleCtr = googleTotals.impressions > 0 ? (googleTotals.clicks / googleTotals.impressions) * 100 : 0
  const googleCustoResultado = googleTotals.conversions > 0 ? googleTotals.spend / googleTotals.conversions : null

  // Aggregate keywords
  const kwMap: Record<string, any> = {}
  for (const m of kwMetrics || []) {
    const k = `${m.keyword}__${m.match_type}__${m.campaign_name}`
    if (!kwMap[k]) {
      kwMap[k] = { keyword: m.keyword, match_type: m.match_type, campaign_name: m.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 }
    }
    kwMap[k].spend += Number(m.spend)
    kwMap[k].impressions += Number(m.impressions)
    kwMap[k].clicks += Number(m.clicks)
    kwMap[k].conversions += Number(m.conversions)
  }
  const keywords = Object.values(kwMap).map(r => ({
    ...r,
    ctr: r.impressions > 0 ? (r.clicks / r.impressions) * 100 : 0,
    custo_resultado: r.conversions > 0 ? r.spend / r.conversions : null,
  })).sort((a, b) => b.spend - a.spend).slice(0, 30)

  // Aggregate creatives
  const adMap: Record<string, any> = {}
  for (const m of adMetrics || []) {
    const k = m.ad_id
    if (!adMap[k]) {
      adMap[k] = {
        ad_name: m.ad_name, campaign_name: m.campaign_name,
        spend: 0, reach: 0, clicks: 0, impressions: 0,
        conversations: 0, leads: 0, purchases: 0, profile_visits: 0, frequency_sum: 0, days: 0,
      }
    }
    adMap[k].spend += Number(m.spend)
    adMap[k].reach += Number(m.reach)
    adMap[k].clicks += Number(m.clicks)
    adMap[k].impressions += Number(m.impressions)
    adMap[k].conversations += Number(m.conversations || 0)
    adMap[k].leads += Number(m.leads || 0)
    adMap[k].purchases += Number(m.purchases || 0)
    adMap[k].profile_visits += Number(m.profile_visits || 0)
    adMap[k].frequency_sum += Number(m.frequency || 0)
    adMap[k].days += 1
  }
  const creatives = Object.values(adMap)
    .filter(a => a.spend > 0)
    .map(a => {
      const resultado = a.conversations > 0 ? a.conversations
        : a.leads > 0 ? a.leads
        : a.purchases > 0 ? a.purchases
        : a.profile_visits
      return {
        ...a,
        resultado,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
        custo_resultado: resultado > 0 ? a.spend / resultado : null,
        frequency: a.days > 0 ? a.frequency_sum / a.days : 0,
      }
    })
    .sort((a, b) => b.spend - a.spend)

  return NextResponse.json({
    from, to,
    meta: {
      totals: { ...metaTotals, ctr: metaCtr, custo_resultado: metaCustoResultado },
      campaigns: metaCampaigns,
      creatives,
    },
    google: {
      totals: { ...googleTotals, ctr: googleCtr, custo_resultado: googleCustoResultado },
      campaigns: googleCampaigns,
      keywords,
    },
  })
}
