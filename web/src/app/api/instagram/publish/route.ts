import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import {
  getInstagramCredentials,
  createMediaContainer,
  createResumableMediaContainer,
  uploadResumableVideo,
  getContainerStatus,
  publishContainer,
  InstagramApiError,
} from '@/lib/instagram'
import { criarPublicacaoInstagram, atualizarPublicacaoInstagram, registrarAuditoria } from '@/lib/firestore'
import { uploadInstagramPhoto, uploadInstagramBackup, deleteInstagramPhoto } from '@/lib/storage'

const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 2500
const MIN_CAROUSEL_ITEMS = 2
const MAX_CAROUSEL_ITEMS = 10
const MAX_COLLABORATORS = 3

type Tipo = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Espera um container terminar de processar. Lança se falhar; devolve `false` se ainda estiver processando depois do tempo de espera. */
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

// POST /api/instagram/publish - Recebe o(s) arquivo(s) direto (multipart) e publica.
// Vídeo/Reels/Story em vídeo vão por resumable upload — o binário direto pro servidor da Meta
// (rupload.facebook.com), sem hospedagem nenhuma no meio. Foto/Story em foto/carrossel sobem pro
// Vercel Blob (só porque a Graph API do Instagram exige uma image_url pública pra criar o container —
// não existe upload binário de foto na API da Meta) e o arquivo é apagado logo depois de publicado.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const formData = await request.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  const tipo = formData.get('tipo') as Tipo | null
  const captionRaw = formData.get('caption')
  const caption = typeof captionRaw === 'string' && captionRaw.trim() ? captionRaw.trim() : undefined
  const altTextRaw = formData.get('altText')
  const altText = typeof altTextRaw === 'string' && altTextRaw.trim() ? altTextRaw.trim() : undefined
  const collaborators = String(formData.get('collaborators') ?? '')
    .split(',')
    .map((u) => u.trim().replace(/^@/, ''))
    .filter(Boolean)
    .slice(0, MAX_COLLABORATORS)
  const isAiGenerated = formData.get('isAiGenerated') === 'true'
  const shareToFeed = formData.get('shareToFeed') !== 'false'
  const coverFile = formData.get('coverFile')
  const direitosAutoraisConfirmado = formData.get('direitosAutoraisConfirmado') === 'true'

  if (!tipo || files.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um arquivo.' }, { status: 400 })
  }
  if (!direitosAutoraisConfirmado) {
    return NextResponse.json({ error: 'Confirme que você tem os direitos de uso dessa mídia antes de publicar.' }, { status: 400 })
  }
  if (tipo === 'CAROUSEL') {
    if (files.length < MIN_CAROUSEL_ITEMS || files.length > MAX_CAROUSEL_ITEMS) {
      return NextResponse.json({ error: `Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.` }, { status: 400 })
    }
  } else if (files.length > 1) {
    return NextResponse.json({ error: 'Esse tipo de publicação aceita só um arquivo.' }, { status: 400 })
  }

  for (const file of files) {
    const isVideo = file.type.startsWith('video/')
    if (!isVideo && !SUPPORTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Formato não suportado — use JPEG, PNG, MP4 ou MOV.' }, { status: 400 })
    }
  }

  let publicacao
  const mediaPaths: string[] = []
  let coverPath: string | undefined
  // Vídeo/Reels/Story em vídeo vão direto pra Meta via resumable upload, sem passar pelo nosso
  // Blob — pra esses, essa é a ÚNICA cópia de backup que existe (ver storage.ts::uploadInstagramBackup
  // e PublicacaoInstagram.backupItems). Foto já vira backup sozinha (só deixamos de apagar
  // mediaPaths/coverPath depois de publicar).
  const backupItems: { url: string; path: string }[] = []

  try {
    const credentials = await getInstagramCredentials()

    // Capa personalizada de Reels (opcional) — sobe primeiro pra já termos a cover_url disponível.
    let coverUrl: string | undefined
    if (tipo === 'REELS' && coverFile instanceof File) {
      const coverBuffer = Buffer.from(await coverFile.arrayBuffer())
      const cover = await uploadInstagramPhoto(contaId, coverBuffer, coverFile.type, 'cover')
      coverPath = cover.path
      coverUrl = cover.url
    }

    let containerId: string

    if (tipo === 'CAROUSEL') {
      const childIds: string[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const isVideo = file.type.startsWith('video/')
        const buffer = Buffer.from(await file.arrayBuffer())

        let childId: string
        if (isVideo) {
          const backupPromise = uploadInstagramBackup(contaId, buffer, file.type, `${Date.now()}-${i}`).catch((err) => {
            console.warn('Falha ao criar backup do vídeo do carrossel:', err)
            return null
          })
          const child = await createResumableMediaContainer(credentials.accessToken, credentials.igUserId, 'VIDEO', { isCarouselItem: true })
          await uploadResumableVideo(credentials.accessToken, child.id, buffer)
          childId = child.id
          const backup = await backupPromise
          if (backup) backupItems.push(backup)
        } else {
          const photo = await uploadInstagramPhoto(contaId, buffer, file.type, String(i))
          mediaPaths.push(photo.path)
          const child = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
            imageUrl: photo.url,
            mediaType: 'IMAGE',
            isCarouselItem: true,
          })
          childId = child.id
        }

        const finished = await waitUntilFinished(credentials.accessToken, childId)
        if (!finished) throw new InstagramApiError(`O item ${i + 1} do carrossel demorou demais pra processar — tente novamente.`)
        childIds.push(childId)
      }

      const parent = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
        mediaType: 'CAROUSEL',
        children: childIds,
        caption,
        collaborators: collaborators.length ? collaborators : undefined,
        isAiGenerated,
      })
      containerId = parent.id
    } else {
      const file = files[0]
      const isVideo = file.type.startsWith('video/')
      const buffer = Buffer.from(await file.arrayBuffer())

      if (isVideo) {
        const backupPromise = uploadInstagramBackup(contaId, buffer, file.type, `${Date.now()}`).catch((err) => {
          console.warn('Falha ao criar backup do vídeo:', err)
          return null
        })
        const container = await createResumableMediaContainer(credentials.accessToken, credentials.igUserId, tipo as 'VIDEO' | 'REELS' | 'STORIES', {
          caption,
          collaborators: collaborators.length ? collaborators : undefined,
          isAiGenerated,
          ...(tipo === 'REELS' ? { coverUrl, shareToFeed } : {}),
        })
        await uploadResumableVideo(credentials.accessToken, container.id, buffer)
        containerId = container.id
        const backup = await backupPromise
        if (backup) backupItems.push(backup)
      } else {
        const photo = await uploadInstagramPhoto(contaId, buffer, file.type)
        mediaPaths.push(photo.path)
        const container = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
          imageUrl: photo.url,
          caption,
          mediaType: tipo,
          altText: tipo === 'IMAGE' ? altText : undefined,
          collaborators: collaborators.length ? collaborators : undefined,
          isAiGenerated,
        })
        containerId = container.id
      }
    }

    publicacao = await criarPublicacaoInstagram(contaId, {
      containerId,
      tipo,
      ...(caption ? { caption } : {}),
      ...(altText && tipo === 'IMAGE' ? { altText } : {}),
      ...(collaborators.length ? { collaborators } : {}),
      ...(isAiGenerated ? { isAiGenerated } : {}),
      ...(tipo === 'REELS' ? { shareToFeed } : {}),
      ...(tipo === 'CAROUSEL' ? { mediaPaths, itemCount: files.length } : mediaPaths[0] ? { mediaPath: mediaPaths[0] } : {}),
      ...(coverPath ? { coverPath } : {}),
      direitosAutoraisConfirmado: true,
      status: 'enviando',
    })

    for (let tentativa = 0; tentativa < POLL_ATTEMPTS; tentativa++) {
      const { status_code } = await getContainerStatus(credentials.accessToken, containerId)

      if (status_code === 'FINISHED') {
        const published = await publishContainer(credentials.accessToken, credentials.igUserId, containerId)
        await atualizarPublicacaoInstagram(contaId, publicacao.id, {
          status: 'publicado',
          mediaId: published.id,
          publicadoEm: new Date(),
          ...(backupItems.length ? { backupItems } : {}),
        })
        // NÃO apaga mediaPaths/coverPath — depois de publicado, esse arquivo já hospedado vira o
        // backup automático da publicação (junto com backupItems, pro que veio de vídeo).
        await registrarAuditoria(contaId, {
          entidade: 'instagram_publicacao',
          entidadeId: publicacao.id,
          acao: 'criar',
          descricao: `Publicou ${tipo === 'CAROUSEL' ? 'um carrossel' : `um(a) ${tipo.toLowerCase()}`} no Instagram`,
          usuarioId: session.user.usuarioId ?? 'desconhecido',
          usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
        }).catch(() => {})
        return NextResponse.json({ publicacaoId: publicacao.id, status: 'publicado', mediaId: published.id })
      }

      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro: `Processamento falhou (${status_code})` })
        await Promise.all(mediaPaths.map((p) => deleteInstagramPhoto(p)))
        if (coverPath) await deleteInstagramPhoto(coverPath)
        await Promise.all(backupItems.map((b) => deleteInstagramPhoto(b.path)))
        return NextResponse.json({ publicacaoId: publicacao.id, status: 'falhou', error: `Processamento falhou (${status_code})` }, { status: 502 })
      }

      if (tentativa < POLL_ATTEMPTS - 1) await sleep(POLL_DELAY_MS)
    }

    // Ainda processando depois do tempo de espera dentro da requisição — o
    // painel continua consultando GET /api/instagram/publications/[id], que finaliza (e loga a
    // auditoria) via lib/instagramPublish.ts::finalizarSePronto quando o container terminar.
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'processando', ...(backupItems.length ? { backupItems } : {}) })
    return NextResponse.json({ publicacaoId: publicacao.id, status: 'processando' })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    if (publicacao) {
      await atualizarPublicacaoInstagram(contaId, publicacao.id, { status: 'falhou', erro: message }).catch(() => {})
    }
    await Promise.all(mediaPaths.map((p) => deleteInstagramPhoto(p)))
    if (coverPath) await deleteInstagramPhoto(coverPath)
    await Promise.all(backupItems.map((b) => deleteInstagramPhoto(b.path)))
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
