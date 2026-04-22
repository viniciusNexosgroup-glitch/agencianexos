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
