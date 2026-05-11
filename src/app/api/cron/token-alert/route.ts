import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const token = process.env.META_ACCESS_TOKEN!
  const phone = process.env.ALERT_WHATSAPP_NUMBER || '5534991438706'
  const instanceName = 'vamo'

  const res = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`
  )
  const data = await res.json()

  const expiresAt = data?.data?.expires_at
  if (!expiresAt) {
    return NextResponse.json({ ok: false, error: 'Não foi possível verificar o token' })
  }

  const expDate = new Date(expiresAt * 1000)
  const now = new Date()
  const daysLeft = Math.floor((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (daysLeft > 2) {
    return NextResponse.json({ ok: true, daysLeft, message: 'Token ok, sem alerta necessário' })
  }

  const dateStr = expDate.toLocaleDateString('pt-BR')
  const message = daysLeft <= 0
    ? `🚨 *Token Meta EXPIRADO!*\n\nSeu token da API do Meta expirou em ${dateStr}.\n\nRenove agora para não interromper o dashboard e os relatórios.`
    : `⚠️ *Token Meta expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}!*\n\nData de expiração: ${dateStr}\n\nRenove o token antes que expire para não interromper o dashboard e os relatórios.`

  await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: process.env.EVOLUTION_API_KEY!,
    },
    body: JSON.stringify({ number: phone, text: message }),
  })

  return NextResponse.json({ ok: true, daysLeft, alerted: true })
}
