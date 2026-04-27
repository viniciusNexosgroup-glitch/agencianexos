import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { canAccessInstance, denied } from '@/lib/tenant'

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
  if (!await canAccessInstance(name, session)) return denied()

  const db = supabase()

  // Verifica se já está conectado no banco
  const { data: inst } = await db
    .from('whatsapp_instances')
    .select('qr_base64, status')
    .eq('instance_name', name)
    .single()

  if (inst?.status === 'connected') {
    return NextResponse.json({ connected: true, base64: null })
  }

  // Sempre tenta buscar/gerar QR direto da Evolution API
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/instance/connect/${name}`,
      { headers: { apikey: process.env.EVOLUTION_API_KEY! } }
    )
    if (res.ok) {
      const data = await res.json()
      // Evolution API v2 retorna { base64, code, count } ou { qrcode: { base64 } }
      const qr = data?.base64 || data?.qrcode?.base64 || null
      if (qr) {
        // Salva no banco para o webhook ter como referência
        await db.from('whatsapp_instances')
          .update({ qr_base64: qr })
          .eq('instance_name', name)
        return NextResponse.json({ base64: qr })
      }

      // Se a instância já está conectada na Evolution API
      if (data?.instance?.state === 'open' || data?.state === 'open') {
        await db.from('whatsapp_instances')
          .update({ status: 'connected', qr_base64: null })
          .eq('instance_name', name)
        return NextResponse.json({ connected: true, base64: null })
      }
    }
  } catch {
    // Falha na Evolution API — tenta retornar QR salvo no banco
  }

  // Fallback: retorna QR salvo no banco (pode ter chegado via webhook)
  return NextResponse.json({ base64: inst?.qr_base64 || null })
}
