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

  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  // Tenta formato simples primeiro, depois com textMessage wrapper
  const bodies = [
    { number, text },
    { number, textMessage: { text } },
  ]

  let lastResult: any = null
  let lastStatus = 0

  for (const bodyPayload of bodies) {
    let res: Response
    try {
      res = await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: API_KEY },
        body: JSON.stringify(bodyPayload),
      })
    } catch (err: any) {
      console.error('Erro ao chamar Evolution API:', err)
      return NextResponse.json({ error: 'Falha ao conectar com a Evolution API: ' + err?.message }, { status: 502 })
    }

    const result = await res.json()
    console.log(`Evolution API send [${res.status}] payload=${JSON.stringify(bodyPayload)} response=${JSON.stringify(result)}`)

    lastResult = result
    lastStatus = res.status

    if (res.ok && !result.error && result.status !== 'error') {
      // Sucesso
      await supabase().from('whatsapp_messages').insert({
        contact_id: contactId,
        instance_name: instanceName,
        message_id: result.key?.id || crypto.randomUUID(),
        from_me: true,
        body: text,
        message_type: 'text',
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ success: true })
    }
  }

  // Retorna o erro completo para debug
  const errMsg = lastResult?.message || lastResult?.error || JSON.stringify(lastResult)
  return NextResponse.json({ error: `[${lastStatus}] ${errMsg}` }, { status: 500 })
}
