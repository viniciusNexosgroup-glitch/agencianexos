import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'missing'
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || 'missing'

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })

  const { data: rows, error } = await supabase
    .from('clients')
    .select('id, email, is_admin')

  return NextResponse.json({
    url_prefix: url.slice(0, 40),
    key_prefix: key.slice(0, 30),
    key_suffix: key.slice(-20),
    key_length: key.length,
    error: error?.message || null,
    rows_count: rows?.length ?? null,
    rows,
  })
}
