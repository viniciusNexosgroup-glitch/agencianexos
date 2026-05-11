import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import { exchangeCode } from '@/lib/google-calendar'

function supabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://dashboard.viniciusguilherme.shop'

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(`${BASE_URL}/login`)

  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(`${BASE_URL}/dashboard/calendar?error=no_code`)

  try {
    const tokens = await exchangeCode(code)

    await supabase()
      .from('google_calendar_tokens')
      .upsert(
        {
          user_email: session.email,
          access_token: tokens.access_token!,
          refresh_token: tokens.refresh_token ?? null,
          expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_email' }
      )

    return NextResponse.redirect(`${BASE_URL}/dashboard/calendar?connected=1`)
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(`${BASE_URL}/dashboard/calendar?error=auth_failed`)
  }
}
