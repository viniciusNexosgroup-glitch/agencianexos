import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { NextRequest, NextResponse } from 'next/server'
import { sendReaction } from '@/lib/evolution'

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

  const { instance_name, remote_jid, message_id, from_me, emoji } = await req.json()
  if (!instance_name || !remote_jid || !message_id || !emoji) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 })
  }

  const result = await sendReaction(
    instance_name,
    { remoteJid: remote_jid, fromMe: from_me ?? false, id: message_id },
    emoji
  )

  // Atualiza reactions localmente no banco
  const db = supabase()
  const { data: msg } = await db
    .from('whatsapp_messages')
    .select('id, reactions')
    .eq('message_id', message_id)
    .maybeSingle()

  if (msg) {
    const reactions = { ...(msg.reactions || {}), me: emoji || undefined }
    if (!emoji) delete reactions.me
    await db.from('whatsapp_messages').update({ reactions }).eq('id', msg.id)
  }

  return NextResponse.json({ success: true, result })
}
