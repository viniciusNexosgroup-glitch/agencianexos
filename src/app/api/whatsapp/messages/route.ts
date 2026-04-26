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

const PAGE_SIZE = 50

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contactId = req.nextUrl.searchParams.get('contact_id')
  if (!contactId) return NextResponse.json({ error: 'contact_id obrigatório' }, { status: 400 })

  const before = req.nextUrl.searchParams.get('before') // cursor: buscar mais antigas
  const after  = req.nextUrl.searchParams.get('after')  // cursor: buscar mais novas (polling)

  const db = supabase()
  let q = db.from('whatsapp_messages').select('*').eq('contact_id', contactId)

  if (after) {
    // Polling incremental: apenas mensagens novas após timestamp
    const { data } = await q.gt('timestamp', after).order('timestamp', { ascending: true })
    return NextResponse.json({ messages: data ?? [], has_more: false }, { headers: { 'Cache-Control': 'no-store' } })
  }

  if (before) {
    // Load more: mensagens mais antigas antes do cursor
    const { data } = await q.lt('timestamp', before).order('timestamp', { ascending: false }).limit(PAGE_SIZE)
    return NextResponse.json({ messages: (data ?? []).reverse(), has_more: (data?.length ?? 0) === PAGE_SIZE }, { headers: { 'Cache-Control': 'no-store' } })
  }

  // Carga inicial: retorna as 50 mensagens mais RECENTES em ordem cronológica
  const { data } = await q.order('timestamp', { ascending: false }).limit(PAGE_SIZE)
  return NextResponse.json({ messages: (data ?? []).reverse(), has_more: (data?.length ?? 0) === PAGE_SIZE }, { headers: { 'Cache-Control': 'no-store' } })
}
