import { NextResponse } from 'next/server'
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name, url } = await req.json()
  if (!name?.trim() || !url?.trim()) return NextResponse.json({ error: 'Nome e URL obrigatórios' }, { status: 400 })

  const { data, error } = await supabase()
    .from('category_videos')
    .insert({ category_id: params.id, name: name.trim(), url: url.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ video: data })
}

export async function DELETE(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('video_id')
  if (!videoId) return NextResponse.json({ error: 'video_id obrigatório' }, { status: 400 })

  const { error } = await supabase()
    .from('category_videos')
    .delete()
    .eq('id', videoId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
