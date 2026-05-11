import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY!.slice(0, 32).padEnd(32, '0')
)

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Email e senha obrigatórios' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: user, error } = await supabase
    .from('clients')
    .select('id, name, email, is_admin, password_hash')
    .eq('email', email)
    .single()

  if (error || !user || !user.password_hash) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const token = await new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    is_admin: user.is_admin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  const response = NextResponse.json({ ok: true, user })
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
