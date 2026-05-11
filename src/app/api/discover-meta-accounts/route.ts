import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const BASE = `https://graph.facebook.com/${process.env.META_API_VERSION || 'v21.0'}`

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const token = process.env.META_ACCESS_TOKEN!
  const db = supabase()

  // Fetch all ad accounts the token has access to
  const url = `${BASE}/me/adaccounts?fields=id,name,account_status,business{id,name}&limit=100&access_token=${token}`
  const res = await fetch(url)
  const json = await res.json()

  if (json.error) {
    return NextResponse.json({ error: json.error.message }, { status: 400 })
  }

  const accounts: Array<{
    id: string
    name: string
    account_status: number
    business?: { id: string; name: string }
  }> = json.data || []

  if (accounts.length === 0) {
    return NextResponse.json({ found: 0, saved: 0 })
  }

  // Upsert all found accounts linked to the current session user
  const rows = accounts.map(a => ({
    client_id: session.sub,
    ad_account_id: a.id,
    account_name: a.name,
    bm_id: a.business?.id || null,
    bm_name: a.business?.name || null,
    is_active: a.account_status === 1,
  }))

  const { error } = await db
    .from('client_accounts')
    .upsert(rows, { onConflict: 'client_id,ad_account_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Desativa contas que não estão mais na resposta da Meta
  const returnedIds = new Set(accounts.map(a => a.id))
  const { data: existingAccounts } = await db
    .from('client_accounts')
    .select('ad_account_id')
    .eq('client_id', session.sub)

  const toDeactivate = (existingAccounts || [])
    .map(a => a.ad_account_id as string)
    .filter(id => !returnedIds.has(id))

  if (toDeactivate.length > 0) {
    await db
      .from('client_accounts')
      .update({ is_active: false })
      .eq('client_id', session.sub)
      .in('ad_account_id', toDeactivate)
  }

  return NextResponse.json({
    found: accounts.length,
    deactivated: toDeactivate.length,
    accounts: rows.map(r => ({ id: r.ad_account_id, name: r.account_name, active: r.is_active })),
  })
}
