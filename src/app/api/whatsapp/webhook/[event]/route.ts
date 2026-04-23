import { NextRequest, NextResponse } from 'next/server'
import { processWebhookEvent } from '@/lib/webhook-handler'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return true
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-webhook-token')
  return token === secret
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ event: string }> }) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  const { event } = await params
  if (!body.event) {
    body.event = event
  }
  console.log('Webhook [event] recebido:', event, JSON.stringify(body).slice(0, 200))
  try {
    await processWebhookEvent(body)
  } catch (err) {
    console.error('Erro ao processar webhook event:', err)
  }
  return NextResponse.json({ ok: true })
}
