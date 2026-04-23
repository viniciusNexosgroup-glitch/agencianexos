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

async function trySendText(instanceName: string, payload: object): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await evFetch(`/message/sendText/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  const body = await res.json().catch(() => ({}))
  console.log(`[send] payload=${JSON.stringify(payload).slice(0, 200)} status=${res.status} response=${JSON.stringify(body).slice(0, 400)}`)
  return { ok: res.ok, status: res.status, body }
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
  const numberFull = isGroup ? phone : phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
  // Para grupos: também tenta sem @g.us (algumas versões da Evolution API v2)
  const numberStripped = isGroup ? phone.replace('@g.us', '') : numberFull

  console.log(`[send] isGroup=${isGroup} numberFull=${numberFull} instance=${instanceName}`)

  // Sequência de tentativas em ordem de prioridade
  const attempts = isGroup
    ? [
        { number: numberFull, text },                         // v2 com @g.us
        { number: numberFull, textMessage: { text } },        // v1 com @g.us
        { number: numberStripped, text },                     // v2 sem @g.us
        { number: numberStripped, textMessage: { text } },    // v1 sem @g.us
      ]
    : [
        { number: numberFull, text },                         // v2 individual
        { number: numberFull, textMessage: { text } },        // v1 individual
      ]

  let lastResult: { ok: boolean; status: number; body: unknown } = { ok: false, status: 0, body: {} }

  for (const payload of attempts) {
    lastResult = await trySendText(instanceName, payload)
    if (lastResult.ok) break
    if (lastResult.status !== 400) break  // erro diferente de validação, para de tentar
  }

  if (!lastResult.ok) {
    const r = lastResult.body as Record<string, unknown>
    const inner = (r?.response as Record<string, unknown>)?.message
    const innerStr = Array.isArray(inner) ? inner.join(', ') : String(inner ?? '')
    const msg = (Array.isArray(r?.message) ? (r.message as string[]).join(', ') : r?.message as string)
      || r?.error as string
      || innerStr
      || JSON.stringify(r)
    return NextResponse.json({ error: `[${numberFull}] ${msg}` }, { status: 500 })
  }

  const result = lastResult.body as Record<string, unknown>
  const { error: dbError } = await supabase().from('whatsapp_messages').insert({
    contact_id: contactId,
    instance_name: instanceName,
    message_id: (result.key as Record<string, unknown>)?.id || crypto.randomUUID(),
    from_me: true,
    body: text,
    message_type: 'text',
    timestamp: new Date().toISOString(),
    is_internal: false,
  })

  if (dbError) console.error('DB insert error:', dbError.message)

  return NextResponse.json({ success: true })
}
