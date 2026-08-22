import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, createMediaContainer, getContainerStatus, publishContainer, InstagramApiError } from '@/lib/instagram'
import { criarPublicacaoInstagram, atualizarPublicacaoInstagram } from '@/lib/firestore'

const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 2500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// POST /api/instagram/publish - Cria o container de mídia e publica (posts, reels, vídeos, stories).
// Vídeo/reels processam de forma assíncrona na Meta: tenta aguardar um pouco (poll com backoff),
// mas se não terminar a tempo, devolve status "processando" — o painel continua consultando
// GET /api/instagram/publications/[id] até a publicação terminar.
export async function POST(request: NextRequest) {
  let body: { mediaUrl?: string; caption?: string; tipo?: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.mediaUrl || !body.tipo) {
    return NextResponse.json({ error: 'Campos "mediaUrl" e "tipo" são obrigatórios' }, { status: 400 })
  }

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  let publicacao
  try {
    const credentials = await getInstagramCredentials()
    const isVideo = body.tipo === 'VIDEO' || body.tipo === 'REELS'

    const container = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
      ...(isVideo ? { videoUrl: body.mediaUrl } : { imageUrl: body.mediaUrl }),
      caption: body.caption,
      mediaType: body.tipo,
    })

    publicacao = await criarPublicacaoInstagram(session.user.contaId, {
      containerId: container.id,
      tipo: body.tipo,
      mediaUrl: body.mediaUrl,
      caption: body.caption,
      status: 'enviando',
    })

    for (let tentativa = 0; tentativa < POLL_ATTEMPTS; tentativa++) {
      const { status_code } = await getContainerStatus(credentials.accessToken, container.id)

      if (status_code === 'FINISHED') {
        const published = await publishContainer(credentials.accessToken, credentials.igUserId, container.id)
        await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, {
          status: 'publicado',
          mediaId: published.id,
          publicadoEm: new Date(),
        })
        return NextResponse.json({ publicacaoId: publicacao.id, status: 'publicado', mediaId: published.id })
      }

      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, { status: 'falhou', erro: `Processamento falhou (${status_code})` })
        return NextResponse.json({ publicacaoId: publicacao.id, status: 'falhou', error: `Processamento falhou (${status_code})` }, { status: 502 })
      }

      if (tentativa < POLL_ATTEMPTS - 1) await sleep(POLL_DELAY_MS)
    }

    // Ainda processando depois do tempo de espera dentro da requisição — o
    // painel continua consultando GET /api/instagram/publications/[id].
    await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, { status: 'processando' })
    return NextResponse.json({ publicacaoId: publicacao.id, status: 'processando' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    if (publicacao) {
      await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, { status: 'falhou', erro: message }).catch(() => {})
    }
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
