import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/lib/session'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  if (!session.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { email, name, password } = await req.json()
  if (!email || !name || !password) {
    return NextResponse.json({ error: 'Email, nome e senha são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  // Verifica se já existe
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('email', email)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Já existe um usuário com esse email' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  // Tenta criar via Supabase Auth Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { name },
  })

  let userId: string | null = authData?.user?.id ?? null

  // Se falhou no Auth, insere diretamente em auth.users
  if (authError || !userId) {
    const newId = crypto.randomUUID()
    const { error: insertError } = await supabase.rpc('exec_sql', {
      sql: `
        INSERT INTO auth.users (
          id, instance_id, email, encrypted_password, email_confirmed_at,
          role, aud, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data, is_super_admin,
          confirmation_token, recovery_token, email_change_token_new, email_change
        )
        SELECT '${newId}', '00000000-0000-0000-0000-000000000000',
          '${email}', '${passwordHash}', NOW(),
          'authenticated', 'authenticated', NOW(), NOW(),
          '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''
        WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '${email}')
      `
    }).catch(() => ({ error: true }))

    if (insertError) {
      return NextResponse.json({
        error: 'Não foi possível criar o usuário automaticamente. Use o SQL Editor do Supabase.',
        sql: `
-- 1. Cole no SQL Editor do Supabase:
INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, role, aud, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, confirmation_token, recovery_token, email_change_token_new, email_change)
SELECT gen_random_uuid(), '00000000-0000-0000-0000-000000000000', '${email}', '${passwordHash}', NOW(), 'authenticated', 'authenticated', NOW(), NOW(), '{"provider":"email","providers":["email"]}', '{}', false, '', '', '', ''
WHERE NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '${email}');

-- 2. Depois:
INSERT INTO clients (id, name, email, is_admin, password_hash)
SELECT id, '${name}', '${email}', false, '${passwordHash}'
FROM auth.users WHERE email = '${email}'
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, is_admin = false;
        `.trim()
      }, { status: 422 })
    }

    // Busca o id inserido
    const { data: authUser } = await supabase
      .from('auth.users' as any)
      .select('id')
      .eq('email', email)
      .maybeSingle()
    userId = (authUser as any)?.id ?? newId
  }

  // Upsert em clients (trigger pode ter criado já, ou não)
  const { error: clientError } = await supabase
    .from('clients')
    .upsert({
      id: userId,
      email,
      name,
      is_admin: false,
      password_hash: passwordHash,
    }, { onConflict: 'id' })

  if (clientError) {
    // Tenta por email se conflito de id
    await supabase
      .from('clients')
      .update({ name, password_hash: passwordHash, is_admin: false })
      .eq('email', email)
  }

  return NextResponse.json({ ok: true, message: `Usuário "${name}" criado com sucesso!` })
}
