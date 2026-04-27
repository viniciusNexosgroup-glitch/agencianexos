export interface GoogleMetricRow {
  customer_id: string
  campaign_id: string
  campaign_name: string
  metric_date: string
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversion_value: number
  ctr: number
  cpc: number | null
  cpm: number | null
}

export async function syncGoogleAccount(
  customerId: string,
  fromDate: string,
  toDate: string
): Promise<{ rows: GoogleMetricRow[]; error?: string }> {
  try {
    const { GoogleAdsApi } = await import('google-ads-api')
    const client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    })

    const customer = client.Customer({
      customer_id: customerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
    })

    const results = await customer.query(`
      SELECT
        campaign.id,
        campaign.name,
        segments.date,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.conversions_value,
        metrics.ctr,
        metrics.average_cpc,
        metrics.average_cpm
      FROM campaign
      WHERE segments.date BETWEEN '${fromDate}' AND '${toDate}'
        AND campaign.status != 'REMOVED'
      ORDER BY segments.date ASC
    `)

    const rows: GoogleMetricRow[] = results.map((r: any) => ({
      customer_id: customerId,
      campaign_id: String(r.campaign.id),
      campaign_name: r.campaign.name,
      metric_date: r.segments.date,
      impressions: Number(r.metrics.impressions) || 0,
      clicks: Number(r.metrics.clicks) || 0,
      spend: (Number(r.metrics.cost_micros) || 0) / 1_000_000,
      conversions: Number(r.metrics.conversions) || 0,
      conversion_value: Number(r.metrics.conversions_value) || 0,
      ctr: Number(r.metrics.ctr) || 0,
      cpc: r.metrics.average_cpc ? Number(r.metrics.average_cpc) / 1_000_000 : null,
      cpm: r.metrics.average_cpm ? Number(r.metrics.average_cpm) / 1_000_000 : null,
    }))

    return { rows }
  } catch (err: any) {
    return { rows: [], error: err.message || String(err) }
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
