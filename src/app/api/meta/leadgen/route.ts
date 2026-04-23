import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function verifySignature(req: NextRequest, rawBody: string): Promise<boolean> {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret) return true // sem secret configurado, passa (desenvolvimento)
  const signature = req.headers.get('x-hub-signature-256')
  if (!signature) return false
  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  return signature === expected
}

// Verificação de webhook Meta (GET)
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode')
  const token = req.nextUrl.searchParams.get('hub.verify_token')
  const challenge = req.nextUrl.searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Recebe evento de Lead Ads (POST)
export async function POST(req: NextRequest) {
  const rawBody = await req.text()
  if (!(await verifySignature(req, rawBody))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }
  const body = JSON.parse(rawBody)
  const db = supabase()

  const entries = body?.entry ?? []
  for (const entry of entries) {
    const changes = entry?.changes ?? []
    for (const change of changes) {
      if (change.field !== 'leadgen') continue

      const leadgenId = change.value?.leadgen_id
      const formId = change.value?.form_id
      const pageId = change.value?.page_id

      if (!leadgenId) continue

      const accessToken = process.env.META_ACCESS_TOKEN
      if (!accessToken) {
        console.error('META_ACCESS_TOKEN não configurado')
        continue
      }

      // Busca dados do lead na Meta API
      const leadRes = await fetch(
        `https://graph.facebook.com/v21.0/${leadgenId}?access_token=${accessToken}`
      )
      if (!leadRes.ok) continue

      const leadData = await leadRes.json()
      const fields: Record<string, string> = {}
      for (const f of leadData.field_data ?? []) {
        fields[f.name] = f.values?.[0] ?? ''
      }

      const phone = (fields.phone_number || fields.phone || '').replace(/\D/g, '')
      const name = fields.full_name || fields.first_name
        ? `${fields.first_name ?? ''} ${fields.last_name ?? ''}`.trim()
        : fields.name || 'Lead Facebook'
      const email = fields.email || null

      if (!phone) continue

      // Busca a primeira instância disponível
      const { data: instance } = await db
        .from('whatsapp_instances')
        .select('instance_name')
        .eq('status', 'connected')
        .limit(1)
        .single()

      if (!instance) continue

      const instanceName = instance.instance_name

      // Cria ou atualiza contato
      const { data: contact } = await db
        .from('whatsapp_contacts')
        .upsert(
          {
            instance_name: instanceName,
            phone,
            remote_jid: `${phone}@s.whatsapp.net`,
            name,
            utm_source: 'facebook',
            utm_medium: 'lead_ads',
            utm_campaign: formId ? `form_${formId}` : null,
          },
          { onConflict: 'instance_name,phone' }
        )
        .select('id')
        .single()

      if (!contact) continue

      // Cria lead no Kanban automaticamente
      const { data: leadStage } = await db
        .from('crm_stages')
        .select('id, funnel_id')
        .eq('name', 'Lead')
        .order('position', { ascending: true })
        .limit(1)
        .single()

      if (leadStage) {
        const { count } = await db
          .from('crm_leads')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', contact.id)

        if ((count ?? 0) === 0) {
          const { data: maxPos } = await db
            .from('crm_leads')
            .select('position')
            .eq('stage_id', leadStage.id)
            .order('position', { ascending: false })
            .limit(1)
            .single()

          await db.from('crm_leads').insert({
            contact_id: contact.id,
            stage_id: leadStage.id,
            funnel_id: leadStage.funnel_id,
            title: name,
            position: (maxPos?.position ?? -1) + 1,
          })
        }
      }

      // Envia mensagem de boas-vindas via Evolution API
      const welcomeMsg = process.env.META_LEADGEN_WELCOME_MSG
        || `Olá ${name.split(' ')[0]}! Vi que você se interessou pelo nosso anúncio. Posso te ajudar?`

      try {
        await fetch(`${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: process.env.EVOLUTION_API_KEY! },
          body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, text: welcomeMsg }),
        })
      } catch (err) {
        console.error('Erro ao enviar mensagem de boas-vindas:', err)
      }

      // Registra notificação
      await db.from('notifications').insert({
        title: 'Novo lead via Facebook Ads',
        body: `${name} (${phone}) preencheu um formulário no Facebook`,
      }).throwOnError().catch(() => null)

      console.log(`Lead Facebook criado: ${name} (${phone})`)
    }
  }

  return NextResponse.json({ received: true })
}
