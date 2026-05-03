import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ balance: null })

  const accountId = req.nextUrl.searchParams.get('account')
  if (!accountId) return NextResponse.json({ balance: null })

  const token = process.env.META_ACCESS_TOKEN!
  const version = process.env.META_API_VERSION || 'v21.0'

  try {
    const res = await fetch(
      `https://graph.facebook.com/${version}/${accountId}?fields=balance,currency&access_token=${token}`,
      { signal: AbortSignal.timeout(10000) }
    )
    const data = await res.json()
    if (data.error || data.balance == null) return NextResponse.json({ balance: null })
    return NextResponse.json({ balance: Number(data.balance) / 100 })
  } catch {
    return NextResponse.json({ balance: null })
  }
}
