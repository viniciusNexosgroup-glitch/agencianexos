import { NextRequest, NextResponse } from 'next/server'
import { processWebhookEvent } from '@/lib/webhook-handler'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) {
    console.warn('[security] WEBHOOK_SECRET não definido — webhook aceita qualquer origem')
    return true
  }
  const token = req.nextUrl.searchParams.get('token') || req.headers.get('x-webhook-token')
  return token === secret
}

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }
  console.log('Webhook POST recebido:', JSON.stringify(body).slice(0, 300))
  // Fire-and-forget: responde imediatamente para Evolution API não reenviar por timeout
  processWebhookEvent(body).catch(err => console.error('Erro ao processar webhook:', err))
  return NextResponse.json({ ok: true })
}
