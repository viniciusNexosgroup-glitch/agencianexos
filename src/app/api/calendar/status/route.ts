import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase()
    .from('google_calendar_tokens')
    .select('user_email, created_at')
    .eq('user_email', session.email)
    .maybeSingle()

  return NextResponse.json({ connected: !!data, connectedAt: data?.created_at ?? null })
}

export async function DELETE() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  await supabase()
    .from('google_calendar_tokens')
    .delete()
    .eq('user_email', session.email)

  return NextResponse.json({ ok: true })
}
