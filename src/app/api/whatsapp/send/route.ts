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

async function evFetch(path: string, init?: RequestInit) {
  return fetch(`${process.env.EVOLUTION_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY!, ...(init?.headers ?? {}) },
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { instanceName, contactId, phone, text, is_internal } = await req.json()

  if (!instanceName || !phone || !text) {
    return NextResponse.json({ error: 'instanceName, phone e text são obrigatórios' }, { status: 400 })
  }

  if (phone.includes('@lid')) {
    return NextResponse.json({ error: 'Contato inválido (dispositivo vinculado)' }, { status: 400 })
  }

  // Nota interna: salva só no banco, não envia pelo WhatsApp
  if (is_internal) {
    const { error: dbError } = await supabase().from('whatsapp_messages').insert({
      contact_id: contactId,
      instance_name: instanceName,
      message_id: crypto.randomUUID(),
      from_me: true,
      body: text,
      message_type: 'text',
      timestamp: new Date().toISOString(),
      is_internal: true,
    })
    if (dbError) console.error('DB insert error (internal note):', dbError.message)
    return NextResponse.json({ success: true })
  }

  const isGroup = phone.includes('@g.us')
  const number = isGroup ? phone : phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  // Para grupos: aquece a sessão do Baileys antes de tentar enviar
  if (isGroup) {
    try {
      await evFetch(`/group/fetchAllGroups/${instanceName}?getParticipants=false`)
    } catch {
      // ignora erro no warm-up, tenta enviar mesmo assim
    }
  }

  const res = await evFetch(`/message/sendText/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ number, textMessage: { text } }),
  })

  const result = await res.json()
  console.log(`send [${res.status}] ${number}:`, JSON.stringify(result).slice(0, 200))

  if (!res.ok) {
    const inner = result?.response?.message
    const innerStr = Array.isArray(inner) ? inner.join(', ') : String(inner ?? '')
    const errMsg = result?.message || result?.error || innerStr || JSON.stringify(result)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  const { error: dbError } = await supabase().from('whatsapp_messages').insert({
    contact_id: contactId,
    instance_name: instanceName,
    message_id: result.key?.id || crypto.randomUUID(),
    from_me: true,
    body: text,
    message_type: 'text',
    timestamp: new Date().toISOString(),
    is_internal: false,
  })

  if (dbError) console.error('DB insert error:', dbError.message)

  return NextResponse.json({ success: true })
}
