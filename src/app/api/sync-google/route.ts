import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { syncGoogleAccount, daysAgo, today } from '@/lib/google-sync'

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  if (secret !== process.env.SYNC_SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID!
  const from = daysAgo(30)
  const to = today()

  const { rows, error } = await syncGoogleAccount(customerId, from, to)

  if (error) {
    return NextResponse.json({ error }, { status: 500 })
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase
      .from('google_campaign_metrics')
      .upsert(rows, { onConflict: 'campaign_id,metric_date' })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({
    message: `Google Ads sync concluído: ${rows.length} registros.`,
    synced: rows.length,
  })
}
