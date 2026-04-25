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

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.redirect(new URL('/login', req.url))

  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.redirect(new URL('/dashboard/calendar?error=no_code', req.url))

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

    return NextResponse.redirect(new URL('/dashboard/calendar?connected=1', req.url))
  } catch (err) {
    console.error('Google Calendar callback error:', err)
    return NextResponse.redirect(new URL('/dashboard/calendar?error=auth_failed', req.url))
  }
}
