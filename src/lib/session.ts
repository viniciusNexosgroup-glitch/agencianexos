import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

if (!process.env.JWT_SECRET) {
  console.warn('[security] JWT_SECRET não definido — usando fallback derivado do SUPABASE_SERVICE_ROLE_KEY. Defina JWT_SECRET no ambiente de produção.')
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ||
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 32).padEnd(32, '0')
)

export interface SessionUser {
  sub: string
  email: string
  name: string
  is_admin: boolean
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as SessionUser
  } catch {
    return null
  }
}
