import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { getAuthUrl } from '@/lib/google-calendar'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  const url = getAuthUrl()
  return NextResponse.redirect(url)
}
