import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { syncGoogleAccount, syncGoogleKeywords, syncGoogleSearchTerms, daysAgo, today } from '@/lib/google-sync'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  const session = await getSession()
  if (secret !== process.env.SYNC_SECRET && !session) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = supabase()

  // Busca contas do banco (descobertas automaticamente)
  const { data: googleAccountsRows } = await db
    .from('google_accounts')
    .select('customer_id')
    .eq('is_active', true)

  let customerIds = (googleAccountsRows || []).map((r: any) => r.customer_id as string)

  // Fallback: variável de ambiente (caso o banco ainda esteja vazio)
  if (customerIds.length === 0) {
    customerIds = (process.env.GOOGLE_ADS_CUSTOMER_ID || '')
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
  }

  if (customerIds.length === 0) {
    return NextResponse.json({ error: 'Nenhuma conta Google Ads configurada. Use o botão "Descobrir contas" na aba Google Ads.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const from = body.from || daysAgo(30)
  const to = body.to || today()

  const errors: string[] = []
  let synced = 0

  for (const customerId of customerIds) {
    // Campaigns
    const { rows: campRows, error: campErr } = await syncGoogleAccount(customerId, from, to)
    if (campErr) { errors.push(`[${customerId}] campaigns: ${campErr}`) }
    else if (campRows.length > 0) {
      const { error: e } = await db.from('google_campaign_metrics').upsert(campRows, { onConflict: 'campaign_id,metric_date' })
      if (e) errors.push(`[${customerId}] campaigns: ${e.message}`)
      else synced += campRows.length
    }

    // Keywords
    const { rows: kwRows, error: kwErr } = await syncGoogleKeywords(customerId, from, to)
    if (kwErr) { errors.push(`[${customerId}] keywords: ${kwErr}`) }
    else if (kwRows.length > 0) {
      const { error: e } = await db.from('google_keyword_metrics').upsert(kwRows, { onConflict: 'customer_id,keyword,match_type,campaign_name,metric_date' })
      if (e) errors.push(`[${customerId}] keywords: ${e.message}`)
      else synced += kwRows.length
    }

    // Search terms — aggregate duplicates (same term in multiple ad groups)
    const { rows: stRows, error: stErr } = await syncGoogleSearchTerms(customerId, from, to)
    if (stErr) { errors.push(`[${customerId}] search_terms: ${stErr}`) }
    else if (stRows.length > 0) {
      const stMap: Record<string, typeof stRows[0]> = {}
      for (const r of stRows) {
        const k = `${r.customer_id}__${r.search_term}__${r.campaign_name}__${r.metric_date}`
        if (!stMap[k]) { stMap[k] = { ...r } }
        else {
          stMap[k].impressions += r.impressions
          stMap[k].clicks += r.clicks
          stMap[k].spend += r.spend
          stMap[k].conversions += r.conversions
        }
      }
      const deduped = Object.values(stMap).map(r => ({
        ...r,
        ctr: r.impressions > 0 ? r.clicks / r.impressions : 0,
      }))
      const { error: e } = await db.from('google_search_term_metrics').upsert(deduped, { onConflict: 'customer_id,search_term,campaign_name,metric_date' })
      if (e) errors.push(`[${customerId}] search_terms: ${e.message}`)
      else synced += deduped.length
    }
  }

  return NextResponse.json({
    message: `Google Ads sync: ${synced} registros de ${customerIds.length} conta(s).`,
    synced,
    accounts: customerIds,
    errors,
  })
}
