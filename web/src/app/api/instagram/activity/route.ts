import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, listRecentMedia, listMediaComments, InstagramApiError } from '@/lib/instagram'
import { listarMencoesRecentes } from '@/lib/firestore'

const POSTS_CONSIDERADOS = 6
const ITENS_MAXIMOS = 10

// GET /api/instagram/activity - "Atividade recente" da Visão geral: comentários mais recentes nas
// últimas publicações, menções já capturadas pelo webhook, e curtidas/comentários agregados. A Graph
// API do Instagram não expõe uma lista de "quem curtiu" nem um endpoint pra buscar menções antigas
// — por isso essa rota combina o que dá pra listar de verdade (comentários), o que já foi capturado
// via webhook (menções, só a partir de agora) e contagens agregadas (curtidas), em vez de simular
// uma "caixa de notificações" completa que a API não suporta.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const credentials = await getInstagramCredentials()
    const media = await listRecentMedia(credentials.accessToken, credentials.igUserId, POSTS_CONSIDERADOS)

    const [comentariosPorMidia, mencoes] = await Promise.all([
      Promise.all(
        media.map((m) =>
          listMediaComments(credentials.accessToken, m.id, { igUserId: credentials.igUserId, username: credentials.username })
            .then((comments) => comments.map((c) => ({ tipo: 'comentario' as const, id: c.id, text: c.text, username: c.username, timestamp: c.timestamp, mediaThumb: m.thumbnail_url ?? m.media_url }))),
        ),
      ).then((r) => r.flat()).catch(() => []),
      listarMencoesRecentes(session.user!.contaId!, 5).catch(() => []),
    ])

    const itensMencoes = mencoes.map((m) => ({
      tipo: 'mencao' as const,
      id: m.id,
      text: m.tipo === 'legenda' ? `mencionou você numa legenda: ${m.text ?? ''}` : `mencionou você num comentário: ${m.text ?? ''}`,
      username: m.username,
      timestamp: new Date(m.timestamp * 1000).toISOString(),
      mediaThumb: undefined as string | undefined,
    }))

    const items = [...comentariosPorMidia, ...itensMencoes]
      .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
      .slice(0, ITENS_MAXIMOS)

    const totalLikes = media.reduce((sum, m) => sum + (m.like_count ?? 0), 0)
    const totalComments = media.reduce((sum, m) => sum + (m.comments_count ?? 0), 0)

    return NextResponse.json({ items, totalLikes, totalComments, postsConsiderados: media.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
