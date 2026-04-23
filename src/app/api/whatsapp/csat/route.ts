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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const agentId = req.nextUrl.searchParams.get('agent_id')
  const days = parseInt(req.nextUrl.searchParams.get('days') ?? '30', 10)

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  const db = supabase()
  let query = db
    .from('csat_responses')
    .select('*')
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  if (agentId) query = query.eq('agent_id', agentId)

  const { data: responses, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const list = responses ?? []

  const avg = list.length > 0 ? list.reduce((sum, r) => sum + (r.score ?? 0), 0) / list.length : null

  const distribution: Record<number, number> = {}
  for (const r of list) {
    const score = r.score as number
    distribution[score] = (distribution[score] ?? 0) + 1
  }

  const comments = list
    .filter((r) => r.comment && r.comment.trim() !== '')
    .map((r) => ({ id: r.id, score: r.score, comment: r.comment, created_at: r.created_at, contact_id: r.contact_id }))

  return NextResponse.json({
    total: list.length,
    avg_score: avg !== null ? Math.round(avg * 100) / 100 : null,
    distribution,
    comments,
    responses: list,
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { contact_id, score, comment } = body

  if (!contact_id || score === undefined || score === null) {
    return NextResponse.json({ error: 'contact_id e score são obrigatórios' }, { status: 400 })
  }

  const numScore = Number(score)
  if (isNaN(numScore) || numScore < 1 || numScore > 5) {
    return NextResponse.json({ error: 'score deve ser entre 1 e 5' }, { status: 400 })
  }

  const { data, error } = await supabase()
    .from('csat_responses')
    .insert({ contact_id, score: numScore, comment: comment ?? null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ response: data }, { status: 201 })
}
