import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterInstagramAccess } from '@/lib/firestore'
import { getInstagramProfile, INSTAGRAM_REQUIRED_SCOPES } from '@/lib/instagram'

// GET /api/instagram/health - Verificação ATIVA da permissão/conexão do Instagram: chama a Graph
// API (GET /me com o token salvo) pra confirmar se ele ainda funciona de verdade — diferente de
// /api/instagram/credentials, que só lê o que está gravado no Firestore. Não usa debug_token
// porque a compatibilidade dele com tokens do "Business Login for Instagram" (Instagram Login
// direto, sem Página do Facebook) não é garantida — um GET /me real é a checagem mais confiável.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const instagramAccess = await obterInstagramAccess(session.user.contaId)
  if (!instagramAccess) {
    return NextResponse.json({ conectado: false, motivo: 'Instagram ainda não conectado nessa conta' })
  }

  if (instagramAccess.desconectadoEm) {
    return NextResponse.json({
      conectado: true,
      tokenValido: false,
      motivo: 'Conta desconectada — precisa reconectar',
      desconectadoEm: instagramAccess.desconectadoEm,
    })
  }

  try {
    const perfil = await getInstagramProfile(instagramAccess.accessToken)
    return NextResponse.json({
      conectado: true,
      tokenValido: true,
      perfil: { id: perfil.id, username: perfil.username, accountType: perfil.account_type },
      expiraEm: instagramAccess.tokenExpiraEm,
      escoposEsperados: INSTAGRAM_REQUIRED_SCOPES,
    })
  } catch (error) {
    return NextResponse.json({
      conectado: true,
      tokenValido: false,
      motivo: error instanceof Error ? error.message : 'Erro desconhecido ao verificar o token no Instagram',
      expiraEm: instagramAccess.tokenExpiraEm,
    })
  }
}
