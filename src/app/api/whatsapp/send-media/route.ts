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

  const { instanceName, contactId, phone, mediatype, mimetype, media, caption } = await req.json()
  if (!instanceName || !phone || !media || !mediatype) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 })
  }

  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  const res = await evFetch(`/message/sendMedia/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ number, mediatype, mimetype, media, caption: caption || '' }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const result = await res.json().catch(() => ({})) as Record<string, unknown>

  if (contactId) {
    await supabase().from('whatsapp_messages').insert({
      contact_id: contactId,
      instance_name: instanceName,
      message_id: (result.key as Record<string, unknown>)?.id as string || crypto.randomUUID(),
      from_me: true,
      body: caption || '',
      message_type: `${mediatype}Message`,
      media_url: `data:${mimetype};base64,${media}`,
      timestamp: new Date().toISOString(),
    })
  }

  return NextResponse.json({ success: true })
}
