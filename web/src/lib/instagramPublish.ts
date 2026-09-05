/**
 * Núcleo compartilhado de publicação agendada/rascunho — usado pelo cron
 * (`api/cron/instagram-publicacoes`), pela ação manual "publicar agora" e
 * pelo polling de `api/instagram/publications/[id]`.
 *
 * Diferente do fluxo de publicação imediata (`api/instagram/publish`), aqui o
 * arquivo já está hospedado publicamente desde o agendamento/rascunho (ver
 * `lib/storage.ts::uploadInstagramMedia`) — por isso todo container é criado
 * via `imageUrl`/`videoUrl`, nunca por resumable upload.
 */

import { obterInstagramAccess, atualizarPublicacaoInstagram } from '@/lib/firestore'
import { createMediaContainer, getContainerStatus, publishContainer, InstagramApiError } from '@/lib/instagram'
import { deleteInstagramPhoto } from '@/lib/storage'
import type { PublicacaoInstagram } from '@/types/database'

const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 2500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitUntilFinished(accessToken: string, containerId: string): Promise<boolean> {
  for (let tentativa = 0; tentativa < POLL_ATTEMPTS; tentativa++) {
    const { status_code } = await getContainerStatus(accessToken, containerId)
    if (status_code === 'FINISHED') return true
    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      throw new InstagramApiError(`Processamento falhou (${status_code})`)
    }
    if (tentativa < POLL_ATTEMPTS - 1) await sleep(POLL_DELAY_MS)
  }
  return false
}

async function limparArquivos(publicacao: PublicacaoInstagram): Promise<void> {
  const paths = [
    ...(publicacao.mediaItems?.map((m) => m.path) ?? []),
    ...(publicacao.mediaPaths ?? []),
    ...(publicacao.mediaPath ? [publicacao.mediaPath] : []),
    ...(publicacao.coverItem ? [publicacao.coverItem.path] : []),
    ...(publicacao.coverPath ? [publicacao.coverPath] : []),
  ]
  await Promise.all(paths.map((p) => deleteInstagramPhoto(p)))
}

/**
 * Consulta o status de um container já criado (status 'processando'). Publica
 * se `FINISHED`, marca `falhou` se `ERROR`/`EXPIRED`, ou devolve sem mudar
 * nada se ainda estiver processando — chamado repetidamente (cron ou GET de
 * polling) até um dos dois primeiros casos acontecer.
 */
export async function finalizarSePronto(contaId: string, publicacao: PublicacaoInstagram): Promise<PublicacaoInstagram> {
  if (publicacao.status !== 'processando' || !publicacao.containerId) return publicacao

  const credentials = await obterInstagramAccess(contaId)
  if (!credentials) {
    const erro = 'Conta do Instagram desconectada.'
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro }).catch(() => {})
    return { ...publicacao, status: 'falhou', erro }
  }

  try {
    const { status_code } = await getContainerStatus(credentials.accessToken, publicacao.containerId)

    if (status_code === 'FINISHED') {
      const published = await publishContainer(credentials.accessToken, credentials.igUserId, publicacao.containerId)
      await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'publicado', mediaId: published.id, publicadoEm: new Date() })
      await limparArquivos(publicacao)
      return { ...publicacao, status: 'publicado', mediaId: published.id }
    }

    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      const erro = `Processamento falhou (${status_code})`
      await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro })
      await limparArquivos(publicacao)
      return { ...publicacao, status: 'falhou', erro }
    }

    return publicacao
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro: message }).catch(() => {})
    await limparArquivos(publicacao)
    return { ...publicacao, status: 'falhou', erro: message }
  }
}

/**
 * Cria o(s) container(s) de uma publicação `agendado`/`rascunho` a partir dos
 * arquivos já hospedados (`mediaItems`), e já tenta finalizar em seguida.
 * Chamada pelo cron (quando `agendadoPara` vence) e pela ação "publicar agora".
 */
export async function criarContainerDeAgendamento(contaId: string, publicacao: PublicacaoInstagram): Promise<PublicacaoInstagram> {
  const credentials = await obterInstagramAccess(contaId)
  if (!credentials) {
    const erro = 'Conta do Instagram desconectada — não foi possível publicar o agendamento.'
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro })
    return { ...publicacao, status: 'falhou', erro }
  }

  const mediaItems = publicacao.mediaItems ?? []
  if (mediaItems.length === 0) {
    const erro = 'Agendamento sem arquivo — nada pra publicar.'
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro })
    return { ...publicacao, status: 'falhou', erro }
  }

  try {
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'enviando' })

    let containerId: string

    if (publicacao.tipo === 'CAROUSEL') {
      const childIds: string[] = []
      for (const item of mediaItems) {
        const child = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
          imageUrl: item.isVideo ? undefined : item.url,
          videoUrl: item.isVideo ? item.url : undefined,
          mediaType: item.isVideo ? 'VIDEO' : 'IMAGE',
          isCarouselItem: true,
        })
        const finished = await waitUntilFinished(credentials.accessToken, child.id)
        if (!finished) throw new InstagramApiError('Um item do carrossel demorou demais pra processar.')
        childIds.push(child.id)
      }

      const parent = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
        mediaType: 'CAROUSEL',
        children: childIds,
        caption: publicacao.caption,
        collaborators: publicacao.collaborators,
        isAiGenerated: publicacao.isAiGenerated,
      })
      containerId = parent.id
    } else {
      const item = mediaItems[0]
      const container = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
        imageUrl: item.isVideo ? undefined : item.url,
        videoUrl: item.isVideo ? item.url : undefined,
        mediaType: publicacao.tipo,
        caption: publicacao.caption,
        altText: publicacao.tipo === 'IMAGE' ? publicacao.altText : undefined,
        collaborators: publicacao.collaborators,
        isAiGenerated: publicacao.isAiGenerated,
        coverUrl: publicacao.coverItem?.url,
        shareToFeed: publicacao.tipo === 'REELS' ? publicacao.shareToFeed : undefined,
      })
      containerId = container.id
    }

    await atualizarPublicacaoInstagram(contaId, publicacao.id, { containerId, status: 'processando' })
    return finalizarSePronto(contaId, { ...publicacao, containerId, status: 'processando' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro: message }).catch(() => {})
    await limparArquivos(publicacao)
    return { ...publicacao, status: 'falhou', erro: message }
  }
}
