import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getQRCode } from '@/lib/evolution'

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

  // Tenta via Evolution API HTTP direto com retries
  for (let i = 0; i < 3; i++) {
    const data = await getQRCode(name)
    console.log(`QR attempt ${i + 1}:`, JSON.stringify(data))
    const base64 =
      data?.base64 ||
      data?.qrcode?.base64 ||
      data?.data?.base64 ||
      null
    if (base64) return NextResponse.json({ base64 })
    await new Promise(r => setTimeout(r, 1500))
  }

  // Fallback: busca do Supabase (salvo pelo webhook)
  const { data: inst } = await supabase()
    .from('whatsapp_instances')
    .select('qr_base64')
    .eq('instance_name', name)
    .single()

  if (inst?.qr_base64) return NextResponse.json({ base64: inst.qr_base64 })

  return NextResponse.json({ base64: null })
}
