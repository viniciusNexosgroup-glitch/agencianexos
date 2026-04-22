import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

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

  const { instanceName, contactId, phone, text } = await req.json()

  if (!instanceName || !phone || !text) {
    return NextResponse.json({ error: 'instanceName, phone e text são obrigatórios' }, { status: 400 })
  }

  if (phone.includes('@lid')) {
    return NextResponse.json({ error: 'Contato inválido (dispositivo vinculado, sem número real)' }, { status: 400 })
  }

  const BASE_URL = process.env.EVOLUTION_API_URL!
  const API_KEY = process.env.EVOLUTION_API_KEY!

  const isGroup = phone.endsWith('@g.us') || phone.includes('@g.us')
  // Individuais: garante @s.whatsapp.net; Grupos: usa JID como está
  const number = isGroup
    ? phone
    : phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  console.log(`Enviando para ${number} via instância ${instanceName}`)

  const res = await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: API_KEY },
    body: JSON.stringify({ number, text }),
  })

  const result = await res.json()
  console.log(`Evolution API [${res.status}]:`, JSON.stringify(result))

  if (!res.ok) {
    const innerMsg = result?.response?.message?.[0] || result?.response?.message || ''
    const errMsg = result?.message || result?.error || JSON.stringify(result)
    const sessionErr = innerMsg?.toString().includes('SessionError')
    if (sessionErr) {
      return NextResponse.json({ error: 'Sessão do grupo não está ativa. Desconecte e reconecte o WhatsApp na aba Instâncias.' }, { status: 500 })
    }
    return NextResponse.json({ error: `[${res.status}] ${errMsg}` }, { status: 500 })
  }

  const { error: dbError } = await supabase().from('whatsapp_messages').insert({
    contact_id: contactId,
    instance_name: instanceName,
    message_id: result.key?.id || crypto.randomUUID(),
    from_me: true,
    body: text,
    message_type: 'text',
    timestamp: new Date().toISOString(),
  })

  if (dbError) {
    console.error('Erro ao salvar mensagem no Supabase:', dbError)
  }

  return NextResponse.json({ success: true })
}
