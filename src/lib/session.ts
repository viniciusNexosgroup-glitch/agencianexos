import { cookies } from 'next/headers'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
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
