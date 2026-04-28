import axios from 'axios'

const BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`
const TOKEN = process.env.META_ACCESS_TOKEN!

interface DailyMetricRow {
  ad_account_id: string
  campaign_id: string
  campaign_name: string
  metric_date: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  ctr: number
  cpc: number | null
  cpm: number | null
  purchases: number
  purchase_value: number
  leads: number
  checkouts: number
  conversations: number
  profile_visits: number
  frequency: number
}

function extractAction(actions: any[], type: string): number {
  return parseInt((actions || []).find(a => a.action_type === type)?.value || '0')
}

function extractActionValue(actionValues: any[], type: string): number {
  return parseFloat((actionValues || []).find(a => a.action_type === type)?.value || '0')
}

export async function syncAccount(
  adAccountId: string,
  fromDate: string,
  toDate: string
): Promise<{ rows: DailyMetricRow[]; error?: string }> {
  try {
    const params: Record<string, string> = {
      access_token: TOKEN,
      fields: 'campaign_id,campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,frequency,actions,action_values',
      level: 'campaign',
      time_range: JSON.stringify({ since: fromDate, until: toDate }),
      time_increment: '1',
      limit: '500',
    }

    const allData: any[] = []
    let url: string | null = `${BASE}/${adAccountId}/insights`
    let firstCall = true

    while (url) {
      const response: { data: { data: any[]; paging?: { next?: string } } } = firstCall
        ? await axios.get(url, { params })
        : await axios.get(url)

      firstCall = false
      allData.push(...(response.data.data || []))
      url = response.data.paging?.next || null
    }

    const rows: DailyMetricRow[] = allData.map(item => ({
      ad_account_id: adAccountId,
      campaign_id: item.campaign_id,
      campaign_name: item.campaign_name,
      metric_date: item.date_start,
      impressions: parseInt(item.impressions || '0'),
      reach: parseInt(item.reach || '0'),
      clicks: parseInt(item.clicks || '0'),
      spend: parseFloat(item.spend || '0'),
      ctr: parseFloat(item.ctr || '0'),
      cpc: item.cpc ? parseFloat(item.cpc) : null,
      cpm: item.cpm ? parseFloat(item.cpm) : null,
      frequency: parseFloat(item.frequency || '0'),
      purchases: extractAction(item.actions, 'purchase'),
      purchase_value: extractActionValue(item.action_values, 'purchase'),
      leads: extractAction(item.actions, 'lead'),
      checkouts: extractAction(item.actions, 'initiate_checkout'),
      conversations: extractAction(item.actions, 'onsite_conversion.messaging_conversation_started_7d'),
      profile_visits: extractAction(item.actions, 'instagram_profile_visit'),
    }))

    return { rows }
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message
    return { rows: [], error: msg }
  }
}

interface AdDailyMetricRow {
  ad_account_id: string
  ad_id: string
  ad_name: string
  campaign_id: string
  campaign_name: string
  adset_id: string
  adset_name: string
  thumbnail_url: string | null
  effective_status: string | null
  metric_date: string
  impressions: number
  reach: number
  clicks: number
  spend: number
  ctr: number
  cpc: number | null
  cpm: number | null
  purchases: number
  purchase_value: number
  leads: number
  checkouts: number
  conversations: number
  profile_visits: number
  frequency: number
}

export async function syncAccountAds(
  adAccountId: string,
  fromDate: string,
  toDate: string
): Promise<{ rows: AdDailyMetricRow[]; error?: string }> {
  try {
    const insightParams: Record<string, string> = {
      access_token: TOKEN,
      fields: 'ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,impressions,reach,clicks,ctr,cpc,cpm,spend,frequency,actions,action_values',
      level: 'ad',
      time_range: JSON.stringify({ since: fromDate, until: toDate }),
      time_increment: '1',
      limit: '500',
    }

    const allInsights: any[] = []
    let url: string | null = `${BASE}/${adAccountId}/insights`
    let firstCall = true

    while (url) {
      const response: { data: { data: any[]; paging?: { next?: string } } } = firstCall
        ? await axios.get(url, { params: insightParams })
        : await axios.get(url)
      firstCall = false
      allInsights.push(...(response.data.data || []))
      url = response.data.paging?.next || null
    }

    const uniqueAdIds = [...new Set(allInsights.map(i => i.ad_id))]
    const thumbnailMap: Record<string, string | null> = {}
    const statusMap: Record<string, string | null> = {}

    for (let i = 0; i < uniqueAdIds.length; i += 50) {
      const chunk = uniqueAdIds.slice(i, i + 50)
      try {
        const adsResp = await axios.get(`${BASE}/`, {
          params: {
            access_token: TOKEN,
            ids: chunk.join(','),
            fields: 'id,effective_status,creative{thumbnail_url}',
          },
        })
        for (const [adId, adData] of Object.entries(adsResp.data as Record<string, any>)) {
          thumbnailMap[adId] = adData.creative?.thumbnail_url || null
          statusMap[adId] = adData.effective_status || null
        }
      } catch {
        // thumbnail fetch is non-critical
      }
    }

    const rows: AdDailyMetricRow[] = allInsights.map(item => ({
      ad_account_id: adAccountId,
      ad_id: item.ad_id,
      ad_name: item.ad_name || '',
      campaign_id: item.campaign_id || '',
      campaign_name: item.campaign_name || '',
      adset_id: item.adset_id || '',
      adset_name: item.adset_name || '',
      thumbnail_url: thumbnailMap[item.ad_id] ?? null,
      effective_status: statusMap[item.ad_id] ?? null,
      metric_date: item.date_start,
      impressions: parseInt(item.impressions || '0'),
      reach: parseInt(item.reach || '0'),
      clicks: parseInt(item.clicks || '0'),
      spend: parseFloat(item.spend || '0'),
      ctr: parseFloat(item.ctr || '0'),
      cpc: item.cpc ? parseFloat(item.cpc) : null,
      cpm: item.cpm ? parseFloat(item.cpm) : null,
      frequency: parseFloat(item.frequency || '0'),
      purchases: extractAction(item.actions, 'purchase'),
      purchase_value: extractActionValue(item.action_values, 'purchase'),
      leads: extractAction(item.actions, 'lead'),
      checkouts: extractAction(item.actions, 'initiate_checkout'),
      conversations: extractAction(item.actions, 'onsite_conversion.messaging_conversation_started_7d'),
      profile_visits: extractAction(item.actions, 'instagram_profile_visit'),
    }))

    return { rows }
  } catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message
    return { rows: [], error: msg }
  }
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export function today(): string {
  return new Date().toISOString().split('T')[0]
}
