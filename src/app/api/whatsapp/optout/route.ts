import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { NextRequest, NextResponse } from 'next/server'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { phone, instance_name, action } = await req.json()

  if (!phone || !instance_name || !action) {
    return NextResponse.json({ error: 'phone, instance_name e action são obrigatórios' }, { status: 400 })
  }

  if (action !== 'opt_out' && action !== 'opt_in') {
    return NextResponse.json({ error: 'action deve ser opt_out ou opt_in' }, { status: 400 })
  }

  const db = supabase()
  const now = new Date().toISOString()

  const contactUpdate: Record<string, unknown> =
    action === 'opt_out'
      ? { opted_in: false, opted_out_at: now }
      : { opted_in: true, opted_in_at: now }

  const { error: updateError } = await db
    .from('whatsapp_contacts')
    .update(contactUpdate)
    .eq('instance_name', instance_name)
    .eq('phone', phone)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  const { error: logError } = await db.from('optout_log').insert({
    phone,
    instance_name,
    action,
    created_at: now,
  })

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase()
    .from('optout_log')
    .select('*, whatsapp_contacts(name, phone)')
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ optouts: data ?? [] })
}
