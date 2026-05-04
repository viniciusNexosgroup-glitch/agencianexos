import { createClient } from '@supabase/supabase-js'

export async function getGoogleRefreshToken(): Promise<string | null> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data } = await supabase
      .from('google_oauth_tokens')
      .select('refresh_token')
      .eq('id', 1)
      .single()

    if (data?.refresh_token) return data.refresh_token
  } catch {}

  return (process.env.GOOGLE_ADS_REFRESH_TOKEN || '').trim() || null
}
