import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exchangeCodeForShortLivedToken, exchangeForLongLivedToken, getInstagramProfile } from '@/lib/instagram'
import { criarInstagramAccess, obterInstagramAccess, atualizarInstagramAccess, registrarAuditoria } from '@/lib/firestore'

// Redirect URI do "Business Login for Instagram" — recebe o `code`, troca
// pelos tokens (curta → longa duração), busca o perfil e salva na conta
// logada. Depois manda de volta pra tela de conexão com o resultado.
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  // O "code" da Meta às vezes vem com "+" sem escapar (parte de um base64
  // "cru") — URLSearchParams trata "+" como espaço (regra do
  // application/x-www-form-urlencoded), corrompendo o código silenciosamente.
  // Escapa antes de deixar o URLSearchParams processar.
  const searchParams = new URLSearchParams(url.search.replace(/\+/g, '%2B'))
  const code = searchParams.get('code')
  const errorDescription = searchParams.get('error_description')
  const destino = new URL('/dashboard/instagram', request.url)

  if (errorDescription) {
    destino.searchParams.set('erro', errorDescription)
    return NextResponse.redirect(destino)
  }
  if (!code) {
    destino.searchParams.set('erro', 'Código de autorização ausente')
    return NextResponse.redirect(destino)
  }

  // Log temporário de diagnóstico — confirma se a query string bruta trazia
  // um "+" sem escapar (indício de que o code estava sendo corrompido antes
  // do fix acima).
  console.log('[Instagram] Callback recebido. query bruta contém "+"?', url.search.includes('+'), '| tamanho do code:', code.length)

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const short = await exchangeCodeForShortLivedToken(code)
    const long = await exchangeForLongLivedToken(short.access_token)
    const profile = await getInstagramProfile(long.access_token)

    const dados = {
      igUserId: profile.id,
      username: profile.username,
      accountType: profile.account_type,
      profilePictureUrl: profile.profile_picture_url,
      accessToken: long.access_token,
      tokenExpiraEm: new Date(Date.now() + long.expires_in * 1000),
      desconectadoEm: null,
    }

    const existing = await obterInstagramAccess(session.user.contaId)
    if (existing) {
      await atualizarInstagramAccess(session.user.contaId, existing.id, dados)
    } else {
      await criarInstagramAccess(session.user.contaId, dados)
    }
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_conta',
      acao: existing ? 'atualizar' : 'criar',
      descricao: `${existing ? 'Reconectou' : 'Conectou'} a conta do Instagram (@${profile.username})`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})

    destino.searchParams.set('conectado', '1')
    return NextResponse.redirect(destino)
  } catch (error) {
    console.error('❌ Erro ao conectar Instagram:', error)
    destino.searchParams.set('erro', error instanceof Error ? error.message : 'Erro desconhecido')
    return NextResponse.redirect(destino)
  }
}
