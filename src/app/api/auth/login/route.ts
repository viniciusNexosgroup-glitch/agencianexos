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

  // Buscar usuário diretamente no banco
  const { data: users, error } = await supabase
    .from('clients')
    .select('id, name, email, is_admin, password_hash')
    .eq('email', email)
    .single()

  if (error || !users) {
    return NextResponse.json({ error: 'Email ou senha incorretos' }, { status: 401 })
  }

  let valid = false

  // Verificar senha: primeiro tenta password_hash local, depois auth.users via RPC
  if ((users as any).password_hash) {
    valid = await bcrypt.compare(password, (users as any).password_hash)
  } else {
    const { data: authData } = await supabase
      .rpc('get_encrypted_password', { user_email: email })
    if (authData) valid = await bcrypt.compare(password, authData)
  }

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
