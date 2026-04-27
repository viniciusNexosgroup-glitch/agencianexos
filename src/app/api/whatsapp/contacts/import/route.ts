import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { getUserInstanceNames } from '@/lib/tenant'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase())

  const rows: Record<string, string>[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? ''
    })
    rows.push(row)
  }
  return rows
}

function resolveField(row: Record<string, string>, candidates: string[]): string {
  for (const key of candidates) {
    if (row[key] !== undefined && row[key] !== '') return row[key]
  }
  return ''
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file')

  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Arquivo CSV obrigatório' }, { status: 400 })
  }

  const text = await (file as File).text()
  const rows = parseCSV(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV vazio ou inválido' }, { status: 400 })
  }

  const allowedInstances = await getUserInstanceNames(session)

  let imported = 0
  let skipped = 0
  const errors: string[] = []

  const db = supabase()

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const phone = resolveField(row, ['telefone', 'phone', 'fone', 'tel'])
    const name = resolveField(row, ['nome', 'name'])
    const instance_name = resolveField(row, ['instancia', 'instância', 'instance_name', 'instance'])

    if (!phone) {
      skipped++
      continue
    }

    if (instance_name && allowedInstances !== null && !allowedInstances.includes(instance_name)) {
      errors.push(`Linha ${i + 2}: instância '${instance_name}' não autorizada`)
      skipped++
      continue
    }

    const remote_jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`

    const record: Record<string, string> = {
      phone,
      remote_jid,
    }
    if (name) record.name = name
    if (instance_name) record.instance_name = instance_name

    const { error } = await db
      .from('whatsapp_contacts')
      .upsert(record, { onConflict: 'phone', ignoreDuplicates: false })

    if (error) {
      errors.push(`Linha ${i + 2}: ${error.message}`)
    } else {
      imported++
    }
  }

  return NextResponse.json({ imported, skipped, errors })
}
