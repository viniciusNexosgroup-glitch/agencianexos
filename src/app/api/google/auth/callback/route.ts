import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const REDIRECT_URI = 'https://dashboard.viniciusguilherme.shop/api/google/auth/callback'
const DASHBOARD_URL = 'https://dashboard.viniciusguilherme.shop/dashboard?tab=google'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  const storedState = req.cookies.get('google_oauth_state')?.value

  if (error || !code || state !== storedState) {
    return NextResponse.redirect(`${DASHBOARD_URL}&google_error=${error || 'oauth_failed'}`)
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  })

  const tokenData = await tokenRes.json()

  if (!tokenData.refresh_token) {
    console.error('[google/auth/callback] token error:', tokenData)
    return NextResponse.redirect(`${DASHBOARD_URL}&google_error=no_refresh_token`)
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  await supabase.from('google_oauth_tokens').upsert(
    { id: 1, refresh_token: tokenData.refresh_token, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  )

  const response = NextResponse.redirect(`${DASHBOARD_URL}&google_connected=1`)
  response.cookies.delete('google_oauth_state')
  return response
}
