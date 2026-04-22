import { NextRequest, NextResponse } from 'next/server'
import { processWebhookEvent } from '@/lib/webhook-handler'

export async function POST(req: NextRequest) {
  const body = await req.json()
  await processWebhookEvent(body)
  return NextResponse.json({ ok: true })
}
