import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function isAuthorized(req: NextRequest) {
  const secret = req.headers.get('x-sync-secret')
  return secret === process.env.SYNC_SECRET
}

// GET /api/admin/cleanup — estatísticas das tabelas + prévia do que seria apagado
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = supabase()

  const [statsRes, previewRes, settingsRes] = await Promise.all([
    db.rpc('get_storage_stats'),
    db.rpc('preview_cleanup'),
    db.from('data_retention_settings').select('*').order('key'),
  ])

  if (statsRes.error) return NextResponse.json({ error: statsRes.error.message }, { status: 500 })

  return NextResponse.json({
    stats: statsRes.data,
    preview: previewRes.data,
    settings: settingsRes.data ?? [],
  })
}

// POST /api/admin/cleanup — executa a limpeza
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = supabase()
  const { data, error } = await db.rpc('cleanup_old_data')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, result: data })
}

// PATCH /api/admin/cleanup — atualiza um período de retenção
export async function PATCH(req: NextRequest) {
  const session = await getSession()
  if (!session && !isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const { key, value_days } = await req.json()
  if (!key || typeof value_days !== 'number' || value_days < 0) {
    return NextResponse.json({ error: 'key e value_days (>= 0) são obrigatórios' }, { status: 400 })
  }

  const { data, error } = await supabase()
    .from('data_retention_settings')
    .update({ value_days, updated_at: new Date().toISOString() })
    .eq('key', key)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ setting: data })
}
