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

  const { data: inst } = await supabase()
    .from('whatsapp_instances')
    .select('qr_base64, status')
    .eq('instance_name', name)
    .single()

  if (inst?.status === 'connected') {
    return NextResponse.json({ connected: true, base64: null })
  }

  return NextResponse.json({ base64: inst?.qr_base64 || null })
}
