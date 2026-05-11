import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncAccount, syncAccountAds, daysAgo, today } from '@/lib/meta-sync'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  const isCron = req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`

  if (secret !== process.env.SYNC_SECRET && !isCron) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: accounts } = await supabase
    .from('client_accounts')
    .select('ad_account_id')
    .eq('is_active', true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: 'Nenhuma conta ativa para sincronizar.' })
  }

  const uniqueIds = Array.from(new Set(accounts.map((a: { ad_account_id: string }) => a.ad_account_id)))
  const from = daysAgo(30)
  const to = today()

  let totalSynced = 0
  const errors: string[] = []

  for (const adAccountId of uniqueIds) {
    const { rows, error } = await syncAccount(adAccountId, from, to)

    if (error) {
      errors.push(`${adAccountId}: ${error}`)
      await supabase.from('sync_logs').insert({
        ad_account_id: adAccountId,
        status: 'error',
        campaigns_synced: 0,
        date_from: from,
        date_to: to,
        error_message: error,
      })
      continue
    }

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from('campaign_metrics')
        .upsert(rows, { onConflict: 'campaign_id,metric_date' })

      if (upsertError) {
        errors.push(`${adAccountId}: ${upsertError.message}`)
        await supabase.from('sync_logs').insert({
          ad_account_id: adAccountId,
          status: 'error',
          campaigns_synced: 0,
          date_from: from,
          date_to: to,
          error_message: upsertError.message,
        })
        continue
      }
    }

    // Sync ad-level metrics (creatives)
    const { rows: adRows, error: adError } = await syncAccountAds(adAccountId, from, to)
    if (!adError && adRows.length > 0) {
      await supabase.from('ad_metrics').upsert(adRows, { onConflict: 'ad_id,metric_date' })
    }

    await supabase.from('sync_logs').insert({
      ad_account_id: adAccountId,
      status: 'success',
      campaigns_synced: rows.length,
      date_from: from,
      date_to: to,
    })

    totalSynced += rows.length
  }

  const message = `Sync concluído: ${totalSynced} registros em ${uniqueIds.length} contas.${errors.length ? ` Erros: ${errors.join(', ')}` : ''}`
  return NextResponse.json({ message, synced: totalSynced, errors })
}
