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

  const { contact_id, message, instance_name } = await req.json()
  if (!contact_id || !message || !instance_name) {
    return NextResponse.json({ error: 'contact_id, message e instance_name são obrigatórios' }, { status: 400 })
  }

  const db = supabase()

  const { data: agent, error: agentError } = await db
    .from('ai_agents')
    .select('*')
    .eq('instance_name', instance_name)
    .eq('is_active', true)
    .maybeSingle()

  if (agentError) return NextResponse.json({ error: agentError.message }, { status: 500 })
  if (!agent) return NextResponse.json({ error: 'Nenhum AI agent ativo para esta instância' }, { status: 404 })

  let { data: conversation } = await db
    .from('ai_conversations')
    .select('*')
    .eq('contact_id', contact_id)
    .eq('instance_name', instance_name)
    .neq('status', 'handed_off')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) {
    const { data: newConv, error: convError } = await db
      .from('ai_conversations')
      .insert({ contact_id, instance_name, status: 'active', history: [] })
      .select()
      .single()

    if (convError) return NextResponse.json({ error: convError.message }, { status: 500 })
    conversation = newConv
  }

  const history: { role: string; content: string }[] = conversation.history ?? []
  history.push({ role: 'user', content: message })

  const messages = [
    { role: 'system', content: agent.system_prompt || '' },
    ...history,
  ]

  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: agent.model || 'gpt-4o-mini',
      messages,
      temperature: agent.temperature ?? 0.7,
    }),
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.text()
    return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 502 })
  }

  const openaiData = await openaiRes.json()
  const reply: string = openaiData.choices?.[0]?.message?.content ?? ''

  history.push({ role: 'assistant', content: reply })

  const keywords: string[] = agent.handoff_keywords ?? []
  const handed_off = keywords.length > 0 && keywords.some((kw: string) =>
    reply.toLowerCase().includes(kw.toLowerCase())
  )

  const newStatus = handed_off ? 'handed_off' : 'active'

  await db
    .from('ai_conversations')
    .update({ history, status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', conversation.id)

  return NextResponse.json({ reply, handed_off })
}
