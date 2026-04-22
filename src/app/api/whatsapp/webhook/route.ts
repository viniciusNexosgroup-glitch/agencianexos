import { NextRequest, NextResponse } from 'next/server'
import { processWebhookEvent } from '@/lib/webhook-handler'

export async function GET() {
  return NextResponse.json({ ok: true, ts: new Date().toISOString() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  console.log('Webhook POST recebido:', JSON.stringify(body).slice(0, 300))
  await processWebhookEvent(body)
  return NextResponse.json({ ok: true })
}
