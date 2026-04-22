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

  // Evolution API v2 exige @s.whatsapp.net para contatos individuais e @g.us para grupos
  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  let evolutionRes: Response
  try {
    evolutionRes = await fetch(`${BASE_URL}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ number, text }),
    })
  } catch (err: any) {
    console.error('Erro ao chamar Evolution API:', err)
    return NextResponse.json({ error: 'Falha ao conectar com a Evolution API' }, { status: 502 })
  }

  const result = await evolutionRes.json()
  console.log(`Evolution API send [${evolutionRes.status}] number=${number}:`, JSON.stringify(result))

  if (!evolutionRes.ok || result.status === 'error' || result.error || result.response?.error) {
    const errMsg = result.message || result.error || result.response?.message || JSON.stringify(result)
    return NextResponse.json({ error: errMsg }, { status: 500 })
  }

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
