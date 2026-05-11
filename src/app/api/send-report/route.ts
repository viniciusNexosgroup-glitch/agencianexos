import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { sendDocument } from '@/lib/evolution'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { adAccountId, pdfBase64, filename } = await req.json()
  if (!adAccountId || !pdfBase64) {
    return NextResponse.json({ error: 'adAccountId e pdfBase64 obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: account } = await supabase
    .from('client_accounts')
    .select('report_group_jid, report_instance_name, account_name')
    .eq('ad_account_id', adAccountId)
    .single()

  if (!account?.report_group_jid || !account?.report_instance_name) {
    return NextResponse.json({ error: 'Nenhum grupo vinculado a esta conta' }, { status: 400 })
  }

  const caption = `📊 Relatório de Anúncios — ${account.account_name || adAccountId}`
  const ok = await sendDocument(
    account.report_instance_name,
    account.report_group_jid,
    pdfBase64,
    filename || 'relatorio.pdf',
    caption
  )

  if (!ok) return NextResponse.json({ error: 'Falha ao enviar para o WhatsApp' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
