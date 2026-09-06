import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exchangeCodeForToken } from '@/lib/canva'
import { salvarCanvaAccess } from '@/lib/firestore'

const PKCE_COOKIE = 'canva_pkce'

// GET /api/canva/callback - Recebe o code do Canva, confere o state (CSRF) e troca pelo token
// usando o verifier guardado no cookie em /api/canva/authorize.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const destino = new URL('/dashboard/instagram?tab=publicar', request.url)

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const cookieValue = request.cookies.get(PKCE_COOKIE)?.value
  if (!code || !state || !cookieValue) {
    destino.searchParams.set('canvaErro', 'Sessão de conexão com o Canva expirou — tente de novo.')
    return NextResponse.redirect(destino)
  }

  let verifier: string
  try {
    const parsed = JSON.parse(cookieValue)
    if (parsed.state !== state) throw new Error('state não bate')
    verifier = parsed.verifier
  } catch {
    destino.searchParams.set('canvaErro', 'Falha de segurança na conexão com o Canva — tente de novo.')
    return NextResponse.redirect(destino)
  }

  try {
    const token = await exchangeCodeForToken(code, verifier)
    await salvarCanvaAccess(session.user.contaId, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiraEm: new Date(Date.now() + token.expires_in * 1000),
    })
    destino.searchParams.set('canvaConectado', '1')
  } catch (error) {
    destino.searchParams.set('canvaErro', error instanceof Error ? error.message : 'Erro desconhecido ao conectar o Canva')
  }

  const response = NextResponse.redirect(destino)
  response.cookies.delete(PKCE_COOKIE)
  return response
}
