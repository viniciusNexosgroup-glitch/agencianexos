import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { findMessageById, getMediaBase64 } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const instance = req.nextUrl.searchParams.get('instance')
  const remoteJid = req.nextUrl.searchParams.get('remote_jid')
  const messageId = req.nextUrl.searchParams.get('message_id')

  if (!instance || !remoteJid || !messageId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  // Busca a mensagem completa na Evolution API (com mediaKey para descriptografar)
  const fullMessage = await findMessageById(instance, remoteJid, messageId)
  if (!fullMessage) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
  }

  // Baixa o vídeo como base64
  const media = await getMediaBase64(instance, fullMessage)
  if (!media?.base64) {
    return NextResponse.json({ error: 'Não foi possível baixar o vídeo' }, { status: 404 })
  }

  const mime = media.mimetype.split(';')[0].trim()
  const buffer = Buffer.from(media.base64, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
