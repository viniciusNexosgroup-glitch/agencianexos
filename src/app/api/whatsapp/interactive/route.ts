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

async function evFetch(path: string, body: unknown) {
  return fetch(`${process.env.EVOLUTION_API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify(body),
  })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { type, instanceName, contactId, phone, ...payload } = await req.json()

  if (!instanceName || !phone || !type) {
    return NextResponse.json({ error: 'type, instanceName e phone são obrigatórios' }, { status: 400 })
  }

  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  let evPath = ''
  let evBody: Record<string, unknown> = {}

  if (type === 'buttons') {
    const { title, body, footer, buttons } = payload
    evPath = `/message/sendButtons/${instanceName}`
    evBody = {
      number,
      title: title || '',
      description: body || '',
      footer: footer || '',
      buttons: (buttons as { id: string; text: string }[]).map(b => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: 1,
      })),
    }
  } else if (type === 'list') {
    const { title, body, footer, buttonText, sections } = payload
    evPath = `/message/sendList/${instanceName}`
    evBody = {
      number,
      title: title || '',
      description: body || '',
      footer: footer || '',
      buttonText: buttonText || 'Ver opções',
      sections: sections ?? [],
    }
  } else {
    return NextResponse.json({ error: 'type deve ser "buttons" ou "list"' }, { status: 400 })
  }

  const res = await evFetch(evPath, evBody)
  const result = await res.json()

  if (!res.ok) {
    return NextResponse.json({ error: result?.message || 'Erro ao enviar mensagem interativa' }, { status: 500 })
  }

  if (contactId) {
    await supabase().from('whatsapp_messages').insert({
      contact_id: contactId,
      instance_name: instanceName,
      message_id: result.key?.id || crypto.randomUUID(),
      from_me: true,
      body: `[${type === 'buttons' ? 'Botões' : 'Lista'}] ${payload.title || payload.body || ''}`,
      message_type: type === 'buttons' ? 'buttonsMessage' : 'listMessage',
      timestamp: new Date().toISOString(),
      is_internal: false,
    })
  }

  return NextResponse.json({ success: true })
}
