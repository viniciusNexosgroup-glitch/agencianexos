import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const BASE_URL = process.env.EVOLUTION_API_URL!
  const API_KEY = process.env.EVOLUTION_API_KEY!
  const instance = req.nextUrl.searchParams.get('instance') || ''
  const number = req.nextUrl.searchParams.get('number') || ''
  const text = req.nextUrl.searchParams.get('text') || 'teste'

  const results: any[] = []

  // Testa 3 formatos diferentes
  const payloads = [
    { label: 'format1: {number, text}', body: { number, text } },
    { label: 'format2: {number, textMessage}', body: { number, textMessage: { text } } },
    { label: 'format3: {number, options, textMessage}', body: { number, options: { delay: 1200 }, textMessage: { text } } },
  ]

  for (const p of payloads) {
    const res = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify(p.body),
    })
    const data = await res.json()
    results.push({ label: p.label, status: res.status, body: p.body, response: data })
    if (res.ok) break // Parou se funcionou
  }

  return NextResponse.json({ BASE_URL, instance, number, results })
}
