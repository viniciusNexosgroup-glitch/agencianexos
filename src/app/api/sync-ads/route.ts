import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { syncAccount, syncAccountAds, daysAgo, today } from '@/lib/meta-sync'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const from = body.from || daysAgo(30)
  const to   = body.to   || today()

  const db = supabase()

  // If a specific accountId is provided, sync only that account
  let uniqueIds: string[]
  if (body.accountId) {
    uniqueIds = [body.accountId]
  } else {
    const { data: accounts } = await db
      .from('client_accounts')
      .select('ad_account_id')
      .eq('is_active', true)

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: 'Nenhuma conta ativa.' })
    }
    uniqueIds = [...new Set(accounts.map((a: { ad_account_id: string }) => a.ad_account_id))]
  }
  let campaignsSynced = 0
  let adsSynced = 0
  const errors: string[] = []

  for (const adAccountId of uniqueIds) {
    // Sync campaign-level metrics
    const { rows: campaignRows, error: campaignError } = await syncAccount(adAccountId, from, to)
    if (campaignError) {
      errors.push(`campaigns/${adAccountId}: ${campaignError}`)
    } else if (campaignRows.length > 0) {
      const { error: upsertErr } = await db
        .from('campaign_metrics')
        .upsert(campaignRows, { onConflict: 'campaign_id,metric_date' })
      if (upsertErr) errors.push(`campaigns/${adAccountId}: ${upsertErr.message}`)
      else campaignsSynced += campaignRows.length
    }

    // Sync ad-level metrics (creatives)
    const { rows: adRows, error: adError } = await syncAccountAds(adAccountId, from, to)
    if (adError) {
      errors.push(`ads/${adAccountId}: ${adError}`)
    } else if (adRows.length > 0) {
      const { error: upsertErr } = await db
        .from('ad_metrics')
        .upsert(adRows, { onConflict: 'ad_id,metric_date' })
      if (upsertErr) errors.push(`ads/${adAccountId}: ${upsertErr.message}`)
      else adsSynced += adRows.length
    }
  }

  return NextResponse.json({
    message: `${campaignsSynced} registros de campanhas e ${adsSynced} de anúncios sincronizados.`,
    campaignsSynced,
    adsSynced,
    errors,
  })
}
