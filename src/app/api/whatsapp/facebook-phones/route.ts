import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { accessToken } = await req.json()
  if (!accessToken) return NextResponse.json({ error: 'Token obrigatório' }, { status: 400 })

  // Busca todas as contas WABA do usuário
  const wabaRes = await fetch(
    `https://graph.facebook.com/v19.0/me/whatsapp_business_accounts?fields=id,name,phone_numbers{id,display_phone_number,verified_name,quality_rating}&access_token=${accessToken}`
  )
  const wabaData = await wabaRes.json()

  if (wabaData.error) {
    return NextResponse.json({ error: wabaData.error.message }, { status: 400 })
  }

  // Normaliza lista de números com seu wabaId
  const phones: { wabaId: string; wabaName: string; phoneNumberId: string; displayNumber: string; verifiedName: string }[] = []

  for (const waba of wabaData.data ?? []) {
    for (const phone of waba.phone_numbers?.data ?? []) {
      phones.push({
        wabaId: waba.id,
        wabaName: waba.name,
        phoneNumberId: phone.id,
        displayNumber: phone.display_phone_number,
        verifiedName: phone.verified_name,
      })
    }
  }

  return NextResponse.json({ phones })
}
