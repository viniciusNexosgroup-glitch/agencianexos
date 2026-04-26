import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { NextRequest, NextResponse } from 'next/server'
import { deleteMessageForEveryone } from '@/lib/evolution'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id, message_id, instance_name, remote_jid, from_me, for_everyone } = await req.json()

  const db = supabase()

  if (for_everyone && message_id && instance_name && remote_jid) {
    try {
      await deleteMessageForEveryone(instance_name, remote_jid, message_id, from_me ?? true)
    } catch { /* falha silenciosa */ }
    // Marca a linha como revogada (igual WhatsApp — mantém a mensagem visível como "Mensagem apagada")
    if (id) {
      await db.from('whatsapp_messages')
        .update({ message_type: 'revoked', body: '', media_url: null, media_data: null })
        .eq('id', id)
    }
  } else {
    // Apagar para mim: remove apenas do banco local
    if (id) {
      await db.from('whatsapp_messages').delete().eq('id', id)
    }
  }

  return NextResponse.json({ success: true })
}
