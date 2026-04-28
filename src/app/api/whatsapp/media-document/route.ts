import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getMediaBase64 } from '@/lib/evolution'
import { canAccessContact } from '@/lib/tenant'

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

  const db = supabase()
  const { data: msg } = await db
    .from('whatsapp_messages')
    .select('media_data, contact_id')
    .eq('message_id', messageId)
    .maybeSingle()

  if (!msg) return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })

  if (msg.contact_id && !await canAccessContact(msg.contact_id, session)) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  }

  if (!msg.media_data) {
    return NextResponse.json({ error: 'Dados do documento não encontrados' }, { status: 404 })
  }

  const data = msg.media_data as Record<string, unknown>
  const fileName = (data.fileName as string) || 'documento'

  const media = await getMediaBase64(instance, msg.media_data)
  if (!media?.base64) {
    return NextResponse.json({ error: 'Não foi possível baixar o documento' }, { status: 502 })
  }

  const mime = media.mimetype?.split(';')[0].trim() || (data.mimetype as string) || 'application/octet-stream'
  const buffer = Buffer.from(media.base64, 'base64')

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': mime,
      'Content-Length': buffer.length.toString(),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
