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

  const funnelId = req.nextUrl.searchParams.get('funnel_id')
  if (!funnelId) return NextResponse.json({ error: 'funnel_id é obrigatório' }, { status: 400 })

  const db = supabase()

  const { data: stages, error: stagesError } = await db
    .from('crm_stages')
    .select('id, name, position')
    .eq('funnel_id', funnelId)
    .order('position', { ascending: true })

  if (stagesError) return NextResponse.json({ error: stagesError.message }, { status: 500 })

  if (!stages || stages.length === 0) {
    return NextResponse.json({ stages: [], lost_reasons: [], funnel_id: funnelId })
  }

  const stageIds = stages.map((s) => s.id)

  const { data: leads, error: leadsError } = await db
    .from('crm_leads')
    .select('id, stage_id, value, created_at, moved_at, lost_reason')
    .in('stage_id', stageIds)

  if (leadsError) return NextResponse.json({ error: leadsError.message }, { status: 500 })

  const leadsByStage = new Map<string, typeof leads>()
  for (const stage of stages) leadsByStage.set(stage.id, [])
  for (const lead of leads ?? []) {
    leadsByStage.get(lead.stage_id)?.push(lead)
  }

  const stageStats = stages.map((stage, index) => {
    const stageLeads = leadsByStage.get(stage.id) ?? []
    const leadCount = stageLeads.length
    const totalValue = stageLeads.reduce((sum, l) => sum + (l.value ?? 0), 0)

    const timeDiffs: number[] = []
    for (const lead of stageLeads) {
      const from = lead.moved_at ?? lead.created_at
      if (from) {
        const diffDays = (Date.now() - new Date(from).getTime()) / (1000 * 60 * 60 * 24)
        timeDiffs.push(diffDays)
      }
    }
    const avgTimeDays =
      timeDiffs.length > 0
        ? Math.round((timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length) * 10) / 10
        : null

    const prevStage = index > 0 ? stages[index - 1] : null
    let conversionRate: number | null = null
    if (prevStage) {
      const prevCount = (leadsByStage.get(prevStage.id) ?? []).length
      conversionRate = prevCount > 0 ? Math.round((leadCount / prevCount) * 1000) / 10 : null
    }

    return {
      stage_id: stage.id,
      stage_name: stage.name,
      position: stage.position,
      lead_count: leadCount,
      total_value: totalValue,
      avg_time_days: avgTimeDays,
      conversion_rate_from_prev: conversionRate,
    }
  })

  const lostLeads = (leads ?? []).filter((l) => l.lost_reason && l.lost_reason.trim() !== '')
  const lostByReason: Record<string, number> = {}
  for (const lead of lostLeads) {
    const reason = lead.lost_reason as string
    lostByReason[reason] = (lostByReason[reason] ?? 0) + 1
  }

  const lostReasons = Object.entries(lostByReason)
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    funnel_id: funnelId,
    stages: stageStats,
    lost_reasons: lostReasons,
  })
}
