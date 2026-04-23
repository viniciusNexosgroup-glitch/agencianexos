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

  const { contact_id, lead_id, event_name, value, currency } = await req.json()
  if (!contact_id || !event_name) {
    return NextResponse.json({ error: 'contact_id e event_name são obrigatórios' }, { status: 400 })
  }

  const db = supabase()

  const { data: contact, error: contactError } = await db
    .from('whatsapp_contacts')
    .select('phone')
    .eq('id', contact_id)
    .single()

  if (contactError || !contact) {
    return NextResponse.json({ error: 'Contato não encontrado' }, { status: 404 })
  }

  const eventTime = Math.floor(Date.now() / 1000)
  let meta_sent = false

  const pixelId = process.env.META_PIXEL_ID
  const accessToken = process.env.META_ACCESS_TOKEN

  if (pixelId && accessToken) {
    const phone = contact.phone.replace(/\D/g, '')
    const metaPayload = {
      data: [
        {
          event_name,
          event_time: eventTime,
          user_data: {
            ph: [phone],
          },
          custom_data: {
            ...(value !== undefined ? { value } : {}),
            ...(currency ? { currency } : {}),
          },
        },
      ],
    }

    const metaRes = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metaPayload),
      }
    )

    meta_sent = metaRes.ok
    if (!metaRes.ok) {
      const errText = await metaRes.text()
      console.error('Meta Conversions API error:', errText)
    }
  }

  const { data: conversion, error: insertError } = await db
    .from('conversion_events')
    .insert({
      contact_id,
      lead_id: lead_id ?? null,
      event_name,
      value: value ?? null,
      currency: currency ?? null,
      event_time: new Date(eventTime * 1000).toISOString(),
      sent_to_meta: meta_sent,
    })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({ success: true, meta_sent, conversion })
}
