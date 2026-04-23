import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { NextRequest, NextResponse } from 'next/server'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instance_name = req.nextUrl.searchParams.get('instance_name')
  if (!instance_name) return NextResponse.json({ error: 'instance_name obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('ai_agents')
    .select('*')
    .eq('instance_name', instance_name)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agent: data })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { instance_name, name, provider, model, system_prompt, is_active, handoff_keywords, temperature } = body

  if (!instance_name) return NextResponse.json({ error: 'instance_name obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('ai_agents')
    .upsert(
      { instance_name, name, provider, model, system_prompt, is_active, handoff_keywords, temperature },
      { onConflict: 'instance_name' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ agent: data })
}
