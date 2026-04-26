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

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data, error } = await supabase()
    .from('broadcast_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ campaigns: data ?? [] })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await req.json()
  const { name, body: messageBody, instance_name, tag_ids } = body

  if (!name || !messageBody || !instance_name) {
    return NextResponse.json({ error: 'name, body e instance_name são obrigatórios' }, { status: 400 })
  }

  const db = supabase()

  let contactsQuery = db
    .from('whatsapp_contacts')
    .select('id, phone')
    .eq('opted_in', true)
    .eq('instance_name', instance_name)

  const { data: contacts, error: contactsError } = await contactsQuery

  if (contactsError) return NextResponse.json({ error: contactsError.message }, { status: 500 })

  let filteredContacts = contacts ?? []

  if (tag_ids && Array.isArray(tag_ids) && tag_ids.length > 0) {
    const { data: taggedContacts, error: tagError } = await db
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('tag_id', tag_ids)
      .in('contact_id', filteredContacts.map((c) => c.id))

    if (tagError) return NextResponse.json({ error: tagError.message }, { status: 500 })

    const contactTagMap = new Map<string, Set<string>>()
    for (const row of taggedContacts ?? []) {
      if (!contactTagMap.has(row.contact_id)) contactTagMap.set(row.contact_id, new Set())
      contactTagMap.get(row.contact_id)!.add(row.tag_id)
    }

    filteredContacts = filteredContacts.filter((c) => {
      const tags = contactTagMap.get(c.id)
      if (!tags) return false
      return tag_ids.every((tid: string) => tags.has(tid))
    })
  }

  const totalRecipients = filteredContacts.length

  const { data: campaign, error: campaignError } = await db
    .from('broadcast_campaigns')
    .insert({
      name,
      body: messageBody,
      instance_name,
      total_recipients: totalRecipients,
      status: 'draft',
      created_by: session.sub,
    })
    .select()
    .single()

  if (campaignError) return NextResponse.json({ error: campaignError.message }, { status: 500 })

  if (filteredContacts.length > 0) {
    const recipients = filteredContacts.map((c) => ({
      campaign_id: campaign.id,
      contact_id: c.id,
      phone: c.phone,
      status: 'pending',
    }))

    const { error: recipientsError } = await db.from('broadcast_recipients').insert(recipients)
    if (recipientsError) return NextResponse.json({ error: recipientsError.message }, { status: 500 })
  }

  return NextResponse.json({ campaign: { ...campaign, total_recipients: totalRecipients } }, { status: 201 })
}
