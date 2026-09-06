import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { auth } from '@/lib/auth'
import { gerarParPkce, getCanvaAuthorizeUrl } from '@/lib/canva'

const PKCE_COOKIE = 'canva_pkce'

// GET /api/canva/authorize - Gera o par PKCE, guarda o verifier num cookie de curta duração
// (a Canva não aceita client secret sozinho na troca do código) e redireciona pra tela de
// autorização do Canva.
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { verifier, challenge } = gerarParPkce()
  const state = randomBytes(16).toString('hex')
  const authorizeUrl = getCanvaAuthorizeUrl(challenge, state)

  const response = NextResponse.redirect(authorizeUrl)
  response.cookies.set(PKCE_COOKIE, JSON.stringify({ verifier, state }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // dev local é http://127.0.0.1, cookie "secure" não seria enviado
    sameSite: 'lax',
    maxAge: 600, // 10 min — tempo de sobra pra completar o login no Canva
    path: '/api/canva',
  })
  return response
}
