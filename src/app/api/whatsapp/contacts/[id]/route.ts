import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { markChatAsRead } from '@/lib/evolution'
import { canAccessContact, denied } from '@/lib/tenant'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  if (!await canAccessContact(params.id, session)) return denied()

  const { action } = await req.json()

  if (action === 'mark_read') {
    const db = supabase()

    // Zera unread_count no CRM
    await db.from('whatsapp_contacts').update({ unread_count: 0 }).eq('id', params.id)

    // Busca dados do contato e última mensagem recebida para enviar leitura ao WhatsApp
    const { data: contact } = await db
      .from('whatsapp_contacts')
      .select('instance_name, remote_jid, phone')
      .eq('id', params.id)
      .maybeSingle()

    if (contact) {
      const remoteJid = contact.remote_jid || `${contact.phone}@s.whatsapp.net`
      // Busca todas as mensagens recebidas recentes para marcar como lidas
      const { data: msgs } = await db
        .from('whatsapp_messages')
        .select('message_id, from_me')
        .eq('contact_id', params.id)
        .eq('from_me', false)
        .order('timestamp', { ascending: false })
        .limit(50)

      if (msgs && msgs.length > 0) {
        const readMessages = msgs.map(m => ({
          remoteJid,
          fromMe: false,
          id: m.message_id,
        }))
        await markChatAsRead(contact.instance_name, readMessages)
      }
    }

    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
