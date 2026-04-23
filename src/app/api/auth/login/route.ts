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

  // Buscar usuário diretamente no banco (bypassa GoTrue)
  const { data: users, error } = await supabase
    .from('clients')
    .select('id, name, email, is_admin')
    .eq('email', email)
    .single()

  if (error || !users) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  // Buscar hash da senha em auth.users via RPC
  const { data: authData, error: authError } = await supabase
    .rpc('get_encrypted_password', { user_email: email })

  if (authError || !authData) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  const valid = await bcrypt.compare(password, authData)
  if (!valid) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  // Criar JWT de sessão
  const token = await new SignJWT({
    sub: users.id,
    email: users.email,
    name: users.name,
    is_admin: users.is_admin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)

  const response = NextResponse.json({ ok: true, user: users })
  response.cookies.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  })
  return response
}
