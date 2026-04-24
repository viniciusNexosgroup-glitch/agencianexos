import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { sendWhatsAppAudio } from '@/lib/evolution'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { instanceName, contactId, phone, audio } = await req.json()
  if (!instanceName || !phone || !audio || !contactId) {
    return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 })
  }

  const result = await sendWhatsAppAudio(instanceName, phone, audio)
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })

  const db = supabase()
  await db.from('whatsapp_messages').insert({
    contact_id: contactId,
    message_id: result.key?.id || `audio-${Date.now()}`,
    from_me: true,
    body: '',
    message_type: 'audioMessage',
    media_url: `data:audio/ogg;base64,${audio}`,
    timestamp: new Date().toISOString(),
    is_internal: false,
  })

  return NextResponse.json({ ok: true })
}
