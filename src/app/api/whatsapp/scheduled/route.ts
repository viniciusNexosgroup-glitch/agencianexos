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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const contact_id = req.nextUrl.searchParams.get('contact_id')
  if (!contact_id) return NextResponse.json({ error: 'contact_id é obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('scheduled_messages')
    .select('*')
    .eq('contact_id', contact_id)
    .eq('status', 'pending')
    .order('send_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ scheduled: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { contact_id, instance_name, body: messageBody, send_at } = body

  if (!contact_id) return NextResponse.json({ error: 'contact_id é obrigatório' }, { status: 400 })
  if (!instance_name) return NextResponse.json({ error: 'instance_name é obrigatório' }, { status: 400 })
  if (!messageBody) return NextResponse.json({ error: 'body é obrigatório' }, { status: 400 })
  if (!send_at) return NextResponse.json({ error: 'send_at é obrigatório' }, { status: 400 })

  const sendAtDate = new Date(send_at)
  if (isNaN(sendAtDate.getTime())) {
    return NextResponse.json({ error: 'send_at inválido' }, { status: 400 })
  }
  if (sendAtDate <= new Date()) {
    return NextResponse.json({ error: 'send_at deve ser no futuro' }, { status: 400 })
  }

  const { data, error } = await supabase()
    .from('scheduled_messages')
    .insert({
      contact_id,
      instance_name,
      body: messageBody,
      send_at: sendAtDate.toISOString(),
      status: 'pending',
      created_by: session.sub,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ scheduled: data }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id é obrigatório' }, { status: 400 })

  const { data: existing, error: fetchError } = await supabase()
    .from('scheduled_messages')
    .select('id, status')
    .eq('id', id)
    .single()

  if (fetchError || !existing) {
    return NextResponse.json({ error: 'Mensagem não encontrada' }, { status: 404 })
  }
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Só é possível cancelar mensagens com status pending' }, { status: 400 })
  }

  const { error } = await supabase().from('scheduled_messages').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
