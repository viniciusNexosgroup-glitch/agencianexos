import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInstance, listInstances, setWebhook } from '@/lib/evolution'
import { getSession } from '@/lib/session'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase().from('whatsapp_instances').select('*').order('created_at', { ascending: false })
  return NextResponse.json({ instances: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, label } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const instanceName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  const result = await createInstance(instanceName)
  console.log('Create instance result:', JSON.stringify(result))
  if (result.error) return NextResponse.json({ error: result.error }, { status: 500 })

  const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`
  await setWebhook(instanceName, webhookUrl)

  await supabase().from('whatsapp_instances').upsert({
    instance_name: instanceName,
    label: label || name,
    status: 'disconnected',
    created_by: session.email,
  }, { onConflict: 'instance_name' })

  // QR code pode vir direto na criação
  const qrBase64 =
    result?.qrcode?.base64 ||
    result?.base64 ||
    result?.data?.qrcode?.base64 ||
    null

  return NextResponse.json({ success: true, instanceName, qrBase64 })
}
