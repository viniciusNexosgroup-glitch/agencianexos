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

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = params
  const db = supabase()

  const { data: inst } = await db
    .from('whatsapp_instances')
    .select('qr_base64, status')
    .eq('instance_name', name)
    .single()

  if (inst?.status === 'connected') {
    return NextResponse.json({ connected: true, base64: null })
  }

  // Se não há QR salvo, chama Evolution API connect para disparar geração do QR
  if (!inst?.qr_base64) {
    try {
      const res = await fetch(
        `${process.env.EVOLUTION_API_URL}/instance/connect/${name}`,
        { headers: { apikey: process.env.EVOLUTION_API_KEY! } }
      )
      const data = await res.json()
      const qr = data?.base64 || data?.qrcode?.base64 || null
      if (qr) {
        await db.from('whatsapp_instances').update({ qr_base64: qr }).eq('instance_name', name)
        return NextResponse.json({ base64: qr })
      }
    } catch {
      // ignora erro, retorna null e aguarda webhook
    }
  }

  return NextResponse.json({ base64: inst?.qr_base64 || null })
}
