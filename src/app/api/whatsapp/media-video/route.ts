import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getMediaBase64 } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const messageId = req.nextUrl.searchParams.get('message_id')
  const instance  = req.nextUrl.searchParams.get('instance')

  if (!messageId || !instance) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  // Busca os dados completos do vídeo salvos no banco
  const db = supabase()
  const { data: msg } = await db
    .from('whatsapp_messages')
    .select('media_data')
    .eq('message_id', messageId)
    .maybeSingle()

  if (!msg?.media_data) {
    return NextResponse.json({ error: 'Dados do vídeo não encontrados. Reenvie o vídeo para atualizá-lo.' }, { status: 404 })
  }

  // Usa os dados salvos para baixar o vídeo da Evolution API
  const media = await getMediaBase64(instance, msg.media_data)
  if (!media?.base64) {
    return NextResponse.json({ error: 'Não foi possível baixar o vídeo' }, { status: 502 })
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
