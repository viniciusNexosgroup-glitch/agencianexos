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

// Lista templates aprovados da Meta Cloud API
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const wabaId = process.env.META_WABA_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  if (!wabaId || !accessToken) {
    return NextResponse.json({ templates: [], error: 'META_WABA_ID e META_ACCESS_TOKEN não configurados' })
  }

  const res = await fetch(
    `https://graph.facebook.com/v21.0/${wabaId}/message_templates?fields=name,status,language,category,components&limit=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!res.ok) {
    const err = await res.text()
    console.error('Meta templates error:', err)
    return NextResponse.json({ templates: [], error: 'Erro ao buscar templates da Meta' })
  }

  const data = await res.json()
  const approved = (data.data ?? []).filter((t: { status: string }) => t.status === 'APPROVED')
  return NextResponse.json({ templates: approved })
}

// Envia template HSM para um contato
export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { instanceName, contactId, phone, templateName, language, components } = await req.json()

  if (!instanceName || !phone || !templateName) {
    return NextResponse.json({ error: 'instanceName, phone e templateName são obrigatórios' }, { status: 400 })
  }

  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

  const evRes = await fetch(`${process.env.EVOLUTION_API_URL}/message/sendTemplate/${instanceName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! },
    body: JSON.stringify({
      number,
      name: templateName,
      language: language || 'pt_BR',
      components: components ?? [],
    }),
  })

  const result = await evRes.json()

  if (!evRes.ok) {
    return NextResponse.json({ error: result?.message || 'Erro ao enviar template' }, { status: 500 })
  }

  if (contactId) {
    await supabase().from('whatsapp_messages').insert({
      contact_id: contactId,
      instance_name: instanceName,
      message_id: result.key?.id || crypto.randomUUID(),
      from_me: true,
      body: `[Template HSM] ${templateName}`,
      message_type: 'templateMessage',
      timestamp: new Date().toISOString(),
      is_internal: false,
    })
  }

  return NextResponse.json({ success: true })
}
