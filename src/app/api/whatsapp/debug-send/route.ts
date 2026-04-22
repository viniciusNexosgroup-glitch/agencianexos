import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const BASE_URL = process.env.EVOLUTION_API_URL!
  const API_KEY = process.env.EVOLUTION_API_KEY!
  const instance = req.nextUrl.searchParams.get('instance') || 'vamo'

  // Busca o primeiro grupo do banco para pegar o JID real
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  const { data: groups } = await db
    .from('whatsapp_contacts')
    .select('phone, remote_jid, name')
    .like('phone', '%@g.us')
    .limit(3)

  const results: any[] = []

  for (const g of groups ?? []) {
    const res = await fetch(`${BASE_URL}/message/sendText/${instance}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: API_KEY },
      body: JSON.stringify({ number: g.phone, text: 'teste debug' }),
    })
    const data = await res.json()
    results.push({ group: g.name, phone: g.phone, status: res.status, response: data })
    break // Testa só o primeiro grupo
  }

  return NextResponse.json({ groups, results })
}
