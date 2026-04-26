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

async function evFetch(path: string, init?: RequestInit) {
  return fetch(`${process.env.EVOLUTION_API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY!, ...(init?.headers ?? {}) },
  })
}

function resolveDriveUrl(url: string): string {
  // Converte links do Google Drive para URL direta de download
  const fileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/)
  if (fileMatch) {
    return `https://drive.usercontent.google.com/download?id=${fileMatch[1]}&export=download&authuser=0&confirm=t`
  }
  const openMatch = url.match(/drive\.google\.com\/open\?.*?id=([a-zA-Z0-9_-]+)/)
  if (openMatch) {
    return `https://drive.usercontent.google.com/download?id=${openMatch[1]}&export=download&authuser=0&confirm=t`
  }
  return url
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { instanceName, contactId, phone, mediatype, mimetype, media, caption } = await req.json()
  if (!instanceName || !phone || !media || !mediatype) {
    return NextResponse.json({ error: 'Parâmetros obrigatórios faltando' }, { status: 400 })
  }

  const number = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`
  const isUrl = typeof media === 'string' && media.startsWith('http')
  const resolvedMedia = isUrl ? resolveDriveUrl(media) : media

  const res = await evFetch(`/message/sendMedia/${instanceName}`, {
    method: 'POST',
    body: JSON.stringify({ number, mediatype, mimetype, media: resolvedMedia, caption: caption || '' }),
  })

  if (!res.ok) {
    const err = await res.text()
    return NextResponse.json({ error: err }, { status: 502 })
  }

  const result = await res.json().catch(() => ({})) as Record<string, unknown>

  if (contactId) {
    await supabase().from('whatsapp_messages').insert({
      contact_id: contactId,
      instance_name: instanceName,
      message_id: (result.key as Record<string, unknown>)?.id as string || crypto.randomUUID(),
      from_me: true,
      body: caption || '',
      message_type: `${mediatype}Message`,
      media_url: isUrl ? resolvedMedia : `data:${mimetype};base64,${media}`,
      timestamp: new Date().toISOString(),
    })
  }

  return NextResponse.json({ success: true })
}
