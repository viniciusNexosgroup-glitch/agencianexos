import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase()
    .from('crm_funnels')
    .select('*, crm_stages(*)')
    .order('created_at', { ascending: true })

  return NextResponse.json({ funnels: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, stages } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const db = supabase()
  const { data: funnel } = await db.from('crm_funnels').insert({ name }).select().single()
  if (!funnel) return NextResponse.json({ error: 'Erro ao criar funil' }, { status: 500 })

  if (stages?.length) {
    const { error: stagesError } = await db.from('crm_stages').insert(
      stages.map((s: string, i: number) => ({ funnel_id: funnel.id, name: s, position: i }))
    )
    if (stagesError) console.error('Erro ao criar etapas do funil:', stagesError.message)
  }

  return NextResponse.json({ funnel })
}
