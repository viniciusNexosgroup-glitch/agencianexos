import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const REDIRECT_URI = 'https://dashboard.viniciusguilherme.shop/api/google/auth/callback'

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.redirect('https://dashboard.viniciusguilherme.shop/login')

  const state = Math.random().toString(36).substring(2, 18)

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/adwords',
    access_type: 'offline',
    prompt: 'consent',
    state,
  })

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
  response.cookies.set('google_oauth_state', state, {
    httpOnly: true,
    maxAge: 600,
    sameSite: 'lax',
    path: '/',
  })
  return response
}
