import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { listGoogleCalendars } from '@/lib/google-calendar'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const items = await listGoogleCalendars(session.email)
  const calendars = items.map(c => ({
    id: c.id!,
    summary: c.summary ?? c.id!,
    color: c.backgroundColor ?? '#4285f4',
    primary: c.primary ?? false,
  }))

  return NextResponse.json({ calendars })
}
