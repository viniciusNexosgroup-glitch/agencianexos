import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getQRCode, getInstanceStatus, deleteInstance, logoutInstance, setWebhook } from '@/lib/evolution'
import { getSession } from '@/lib/session'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = params
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'qr') {
    const data = await getQRCode(name)
    console.log('QR response raw:', JSON.stringify(data))
    // Normaliza diferentes formatos da Evolution API
    const base64 =
      data?.base64 ||
      data?.qrcode?.base64 ||
      data?.data?.base64 ||
      data?.qr?.base64 ||
      null
    return NextResponse.json({ ...data, base64 })
  }

  const data = await getInstanceStatus(name)
  const state = data?.instance?.state || data?.state || ''
  const status = state === 'open' ? 'connected' : 'disconnected'
  await supabase().from('whatsapp_instances').update({ status }).eq('instance_name', name)
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = params
  const action = req.nextUrl.searchParams.get('action')

  if (action === 'logout') {
    await logoutInstance(name)
    await supabase().from('whatsapp_instances').update({ status: 'disconnected' }).eq('instance_name', name)
    return NextResponse.json({ success: true })
  }

  await deleteInstance(name)
  await supabase().from('whatsapp_instances').delete().eq('instance_name', name)
  return NextResponse.json({ success: true })
}

export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = params
  const body = await req.json()

  if (body.action === 'set_webhook') {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.viniciusguilherme.shop'
    const webhookUrl = `${baseUrl}/api/whatsapp/webhook`
    const result = await setWebhook(name, webhookUrl)
    return NextResponse.json({ success: true, result })
  }

  return NextResponse.json({ error: 'action inválida' }, { status: 400 })
}
