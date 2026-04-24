import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id obrigatório' }, { status: 400 })

  const { data } = await supabase()
    .from('whatsapp_messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('timestamp', { ascending: true })
    .limit(100)

  return NextResponse.json({ messages: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  })
}
