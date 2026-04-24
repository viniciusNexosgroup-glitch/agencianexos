import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { sendWhatsAppAudio } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { instanceName, phone, audio } = await req.json()
  if (!instanceName || !phone || !audio) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const result = await sendWhatsAppAudio(instanceName, phone, audio)
  if (result?.error) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ ok: true })
}
