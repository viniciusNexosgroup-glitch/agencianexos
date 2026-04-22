import { NextRequest, NextResponse } from 'next/server'
import { processWebhookEvent } from '../route'

export async function POST(req: NextRequest, { params }: { params: { event: string } }) {
  const body = await req.json()
  // Normaliza o evento do path para o formato esperado
  if (!body.event) {
    body.event = params.event
  }
  await processWebhookEvent(body)
  return NextResponse.json({ ok: true })
}
