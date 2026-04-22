import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 32).padEnd(32, '0')
)

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/')

  const sessionCookie = request.cookies.get('session')?.value

  let user = null
  if (sessionCookie) {
    try {
      const { payload } = await jwtVerify(sessionCookie, JWT_SECRET)
      user = payload
    } catch {
      // token inválido ou expirado
    }
  }

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
