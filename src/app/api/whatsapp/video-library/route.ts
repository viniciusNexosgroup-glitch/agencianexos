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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const db = supabase()

  const { data: categories, error: catError } = await db
    .from('video_categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

  const { data: videos, error: vidError } = await db
    .from('category_videos')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (vidError) return NextResponse.json({ error: vidError.message }, { status: 500 })

  const result = (categories ?? []).map(cat => ({
    ...cat,
    videos: (videos ?? []).filter(v => v.category_id === cat.id),
  }))

  return NextResponse.json({ categories: result })
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const { data, error } = await supabase()
    .from('video_categories')
    .insert({ name: name.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ category: { ...data, videos: [] } })
}
