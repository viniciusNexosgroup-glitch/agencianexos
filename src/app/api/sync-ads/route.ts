import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { syncAccountAds, daysAgo, today } from '@/lib/meta-sync'

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

  const { data: accounts } = await db
    .from('client_accounts')
    .select('ad_account_id')
    .eq('is_active', true)

  if (!accounts || accounts.length === 0) {
    return NextResponse.json({ message: 'Nenhuma conta ativa.' })
  }

  const uniqueIds = [...new Set(accounts.map((a: { ad_account_id: string }) => a.ad_account_id))]
  let totalSynced = 0
  const errors: string[] = []

  for (const adAccountId of uniqueIds) {
    const { rows, error } = await syncAccountAds(adAccountId, from, to)
    if (error) { errors.push(`${adAccountId}: ${error}`); continue }
    if (rows.length > 0) {
      const { error: upsertErr } = await db
        .from('ad_metrics')
        .upsert(rows, { onConflict: 'ad_id,metric_date' })
      if (upsertErr) { errors.push(`${adAccountId}: ${upsertErr.message}`); continue }
      totalSynced += rows.length
    }
  }

  return NextResponse.json({
    message: `${totalSynced} registros de anúncios sincronizados.`,
    synced: totalSynced,
    errors,
  })
}
