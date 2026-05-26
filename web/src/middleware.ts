import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Rotas públicas que não exigem autenticação
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/politica-de-privacidade',
  '/termos-de-uso',
]

export function middleware(request: NextRequest) {
  const session = request.cookies.get('session')
  const { pathname } = request.nextUrl

  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  )

  // Redireciona para login se não há sessão e a rota não é pública
  if (!session && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redireciona para dashboard se já está autenticado e tenta acessar login
  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  // Aplica o middleware em todas as rotas, exceto assets estáticos
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
