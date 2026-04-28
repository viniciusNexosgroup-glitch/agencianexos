import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createInstance, createCloudApiInstance, listInstances, setWebhook } from '@/lib/evolution'
import { getSession } from '@/lib/session'
import { getUserInstanceNames } from '@/lib/tenant'

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

  const names = await getUserInstanceNames(session)
  let q = supabase().from('whatsapp_instances').select('*').order('created_at', { ascending: false })
  if (names !== null) q = q.eq('created_by', session.email)
  const { data } = await q
  return NextResponse.json({ instances: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, label, provider, token, phoneNumberId, wabaId } = await req.json()
  if (!name) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const instanceName = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

  if (provider === 'cloud_api') {
    if (!token || !phoneNumberId) {
      return NextResponse.json({ error: 'Token e Phone Number ID são obrigatórios para a API Oficial' }, { status: 400 })
    }
    const result = await createCloudApiInstance(instanceName, token, phoneNumberId, wabaId)
    console.log('Create Cloud API instance result:', JSON.stringify(result))

    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/whatsapp/webhook`
    await setWebhook(instanceName, webhookUrl).catch(() => null)

    await supabase().from('whatsapp_instances').upsert({
      instance_name: instanceName,
      label: label || name,
      status: 'connected',
      created_by: session.email,
      provider: 'cloud_api',
      phone_number_id: phoneNumberId,
      waba_id: wabaId || null,
    }, { onConflict: 'instance_name' })

    return NextResponse.json({ success: true, instanceName, provider: 'cloud_api' })
  }

  // Baileys (WhatsApp Web)
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
    provider: 'baileys',
  }, { onConflict: 'instance_name' })

  const qrBase64 =
    result?.qrcode?.base64 ||
    result?.base64 ||
    result?.data?.qrcode?.base64 ||
    null

  return NextResponse.json({ success: true, instanceName, qrBase64 })
}
