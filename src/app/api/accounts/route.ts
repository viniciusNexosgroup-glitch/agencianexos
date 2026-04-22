import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const authSupabase = await createServerClient()
  const { data: { user } } = await authSupabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { data: me } = await authSupabase.from('clients').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { client_id, ad_account_id, account_name, bm_name } = await req.json()
  if (!client_id || !ad_account_id) {
    return NextResponse.json({ error: 'client_id e ad_account_id são obrigatórios' }, { status: 400 })
  }

  const normalized = ad_account_id.startsWith('act_') ? ad_account_id : `act_${ad_account_id}`

  const { error } = await authSupabase.from('client_accounts').insert({
    client_id,
    ad_account_id: normalized,
    account_name: account_name || normalized,
    bm_name: bm_name || null,
    is_active: true,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ message: `Conta ${normalized} vinculada com sucesso.` })
}
