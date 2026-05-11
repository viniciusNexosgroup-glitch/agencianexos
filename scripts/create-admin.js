const https = require('https')

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || ''
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''

function runSQL(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql })
    const options = {
      hostname: 'api.supabase.com',
      path: '/v1/projects/' + PROJECT_REF + '/database/query',
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + TOKEN,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }
    const req = https.request(options, res => {
      let data = ''
      res.on('data', d => data += d)
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const SQL_CREATE_USER = [
  "INSERT INTO auth.users (",
  "  id, instance_id, aud, role, email,",
  "  encrypted_password, email_confirmed_at,",
  "  raw_app_meta_data, raw_user_meta_data,",
  "  created_at, updated_at, confirmation_token, recovery_token",
  ") VALUES (",
  "  gen_random_uuid(),",
  "  '00000000-0000-0000-0000-000000000000',",
  "  'authenticated', 'authenticated',",
  "  'viniguisan@gmail.com',",
  "  crypt('MetaAds@2026', gen_salt('bf')),",
  "  now(),",
  "  '{\"provider\":\"email\",\"providers\":[\"email\"]}'::jsonb,",
  "  '{\"name\":\"Vinicius Guilherme\"}'::jsonb,",
  "  now(), now(), '', ''",
  ")",
  "RETURNING id, email;"
].join('\n')

const SQL_SET_ADMIN = [
  "UPDATE public.clients SET is_admin = TRUE, name = 'Vinicius Guilherme'",
  "WHERE email = 'viniguisan@gmail.com'",
  "RETURNING id, email, is_admin;"
].join('\n')

const SQL_CHECK = "SELECT id, name, email, is_admin FROM public.clients;"

async function main() {
  console.log('Passo 1: Criando usuario em auth.users...')
  const step1 = await runSQL(SQL_CREATE_USER)
  console.log('Status:', step1.status)
  console.log('Resultado:', JSON.stringify(step1.data, null, 2))

  if (step1.status !== 201) {
    console.log('\nErro ao criar usuario. Verificando se ja existe...')
    const check = await runSQL(SQL_CHECK)
    console.log('Clientes existentes:', JSON.stringify(check.data, null, 2))
    return
  }

  console.log('\nPasso 2: Setando como admin...')
  const step2 = await runSQL(SQL_SET_ADMIN)
  console.log('Status:', step2.status)
  console.log('Resultado:', JSON.stringify(step2.data, null, 2))

  console.log('\nPasso 3: Verificando...')
  const check = await runSQL(SQL_CHECK)
  console.log(JSON.stringify(check.data, null, 2))

  if (check.data && check.data.length > 0) {
    const u = check.data[0]
    console.log('\n✓ Tudo pronto!')
    console.log('  Email: ' + u.email)
    console.log('  Admin: ' + u.is_admin)
    console.log('  Senha inicial: MetaAds@2026')
  }
}

main().catch(console.error)
