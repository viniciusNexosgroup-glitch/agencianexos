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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function warmupGroup(instanceName: string, groupJid: string) {
  // Força Baileys a carregar participantes e chaves do grupo
  await evFetch(`/group/fetchAllGroups/${instanceName}?getParticipants=true`).catch(() => null)
  // Quando not-acceptable ocorre, o Baileys internamente tenta distribuir as chaves —
  // aguarda tempo suficiente para isso completar antes do retry
  await sleep(5000)
  console.log(`[send] warm-up concluído para ${groupJid}`)
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

  async function doSend() {
    return evFetch(`/message/sendText/${instanceName}`, {
      method: 'POST',
      body: JSON.stringify({ number, text }),
    })
  }

  let res = await doSend()
  let result = await res.json().catch(() => ({})) as Record<string, unknown>

  // Se grupo retornar not-acceptable, aquece a sessão e tenta de novo
  if (!res.ok && isGroup) {
    const msgs = ((result?.response as Record<string, unknown>)?.message ?? []) as unknown[]
    const isNotAcceptable = JSON.stringify(msgs).includes('not-acceptable')
    if (isNotAcceptable) {
      console.log(`[send] not-acceptable para grupo ${number} — aquecendo sessão e tentando novamente...`)
      await warmupGroup(instanceName, number)
      res = await doSend()
      result = await res.json().catch(() => ({})) as Record<string, unknown>
    }
  }

  if (!res.ok) {
    const msgs = (result?.response as Record<string, unknown>)?.message
    const detail = Array.isArray(msgs) ? msgs.flat().join(', ') : String(msgs ?? '')
    const errMsg = detail || result?.message as string || result?.error as string || JSON.stringify(result)
    if (errMsg.includes('not-acceptable')) {
      return NextResponse.json({ error: 'Não foi possível enviar ao grupo. Aguarde um momento e tente novamente — o WhatsApp pode estar sincronizando as chaves do grupo.' }, { status: 400 })
    }
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

  const { error: dbError } = await supabase().from('whatsapp_messages').insert({
    contact_id: contactId,
    instance_name: instanceName,
    message_id: (result.key as Record<string, unknown>)?.id as string || crypto.randomUUID(),
    from_me: true,
    body: text,
    message_type: 'text',
    timestamp: new Date().toISOString(),
    is_internal: false,
  })

  if (dbError) console.error('DB insert error:', dbError.message)

  return NextResponse.json({ success: true })
}
