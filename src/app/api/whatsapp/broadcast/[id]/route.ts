import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { denied } from '@/lib/tenant'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function sendEvolutionMessage(instance: string, number: string, text: string) {
  const url = `${process.env.EVOLUTION_API_URL}/message/sendText/${instance}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({ number, text }),
  })
  return res.ok
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function dispatchCampaign(campaignId: string) {
  const db = supabase()

  const { data: campaign } = await db
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', campaignId)
    .single()

  if (!campaign) return

  await db.from('broadcast_campaigns').update({ status: 'sending' }).eq('id', campaignId)

  const { data: recipients } = await db
    .from('broadcast_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')

  let sent = 0
  let failed = 0

  for (const recipient of recipients ?? []) {
    const success = await sendEvolutionMessage(campaign.instance_name, recipient.phone, campaign.body)

    await db
      .from('broadcast_recipients')
      .update({
        status: success ? 'sent' : 'failed',
        sent_at: success ? new Date().toISOString() : null,
      })
      .eq('id', recipient.id)

    if (success) sent++
    else failed++

    await sleep(1000)
  }

  await db
    .from('broadcast_campaigns')
    .update({
      status: 'done',
      sent_count: sent,
      failed_count: failed,
      finished_at: new Date().toISOString(),
    })
    .eq('id', campaignId)
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const db = supabase()

  const { data: campaign, error } = await db
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  if (!session.is_admin && campaign.created_by !== session.sub) return denied()

  const { data: recipients } = await db
    .from('broadcast_recipients')
    .select('*')
    .eq('campaign_id', id)
    .order('created_at', { ascending: true })

  const stats = {
    total: recipients?.length ?? 0,
    pending: recipients?.filter((r) => r.status === 'pending').length ?? 0,
    sent: recipients?.filter((r) => r.status === 'sent').length ?? 0,
    failed: recipients?.filter((r) => r.status === 'failed').length ?? 0,
  }

  return NextResponse.json({ campaign, recipients: recipients ?? [], stats })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const body = await req.json()

  if (body.action !== 'start') {
    return NextResponse.json({ error: 'action inválida' }, { status: 400 })
  }

  const db = supabase()
  const { data: campaign } = await db
    .from('broadcast_campaigns')
    .select('*')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  if (!session.is_admin && campaign.created_by !== session.sub) return denied()

  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: `Campanha não pode ser iniciada (status: ${campaign.status})` }, { status: 400 })
  }

  dispatchCampaign(id).catch(console.error)

  return NextResponse.json({ message: 'Campanha iniciada em segundo plano' })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = params
  const db = supabase()

  const { data: campaign } = await db
    .from('broadcast_campaigns')
    .select('status')
    .eq('id', id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Campanha não encontrada' }, { status: 404 })
  if (!session.is_admin && campaign.created_by !== session.sub) return denied()

  if (campaign.status !== 'draft') {
    return NextResponse.json({ error: 'Apenas campanhas com status draft podem ser canceladas' }, { status: 400 })
  }

  const { error } = await db.from('broadcast_campaigns').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
