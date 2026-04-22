import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(req: NextRequest, { params }: { params: { name: string } }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const BASE_URL = process.env.EVOLUTION_API_URL!
  const API_KEY = process.env.EVOLUTION_API_KEY!
  const { name } = params

  try {
    const res = await fetch(`${BASE_URL}/group/fetchAllGroups/${name}?getParticipants=false`, {
      headers: { apikey: API_KEY },
    })
    const data = await res.json()
    const count = Array.isArray(data) ? data.length : 0
    return NextResponse.json({ success: true, groups: count })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
