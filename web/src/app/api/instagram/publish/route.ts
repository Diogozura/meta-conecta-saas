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
import { criarPublicacaoInstagram, atualizarPublicacaoInstagram } from '@/lib/firestore'
import { uploadInstagramPhoto, deleteInstagramPhoto } from '@/lib/storage'

const POLL_ATTEMPTS = 5
const POLL_DELAY_MS = 2500

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type Tipo = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

// POST /api/instagram/publish - Recebe o arquivo direto (multipart) e publica.
// Vídeo/Reels/Story em vídeo vão por resumable upload — o binário direto pro servidor da Meta
// (rupload.facebook.com), sem hospedagem nenhuma no meio. Foto/Story em foto sobem pro Vercel
// Blob (só porque a Graph API do Instagram exige uma image_url pública pra criar o container —
// não existe upload binário de foto na API da Meta) e o arquivo é apagado logo depois de publicado.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const tipo = formData.get('tipo') as Tipo | null
  const captionRaw = formData.get('caption')
  const caption = typeof captionRaw === 'string' && captionRaw.trim() ? captionRaw.trim() : undefined

  if (!(file instanceof File) || !tipo) {
    return NextResponse.json({ error: 'Campos "file" e "tipo" são obrigatórios' }, { status: 400 })
  }

  const isVideo = file.type.startsWith('video/')
  if (!isVideo && !SUPPORTED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Formato não suportado — use JPEG, PNG, MP4 ou MOV.' }, { status: 400 })
  }

  let publicacao
  let mediaPath: string | undefined
  try {
    const credentials = await getInstagramCredentials()
    const buffer = Buffer.from(await file.arrayBuffer())

    let containerId: string
    if (isVideo) {
      const container = await createResumableMediaContainer(credentials.accessToken, credentials.igUserId, tipo as 'VIDEO' | 'REELS' | 'STORIES', caption)
      await uploadResumableVideo(credentials.accessToken, container.id, buffer)
      containerId = container.id
    } else {
      const photo = await uploadInstagramPhoto(session.user.contaId, buffer, file.type)
      mediaPath = photo.path
      const container = await createMediaContainer(credentials.accessToken, credentials.igUserId, {
        imageUrl: photo.url,
        caption,
        mediaType: tipo,
      })
      containerId = container.id
    }

    publicacao = await criarPublicacaoInstagram(session.user.contaId, {
      containerId,
      tipo,
      ...(caption ? { caption } : {}),
      ...(mediaPath ? { mediaPath } : {}),
      status: 'enviando',
    })

    for (let tentativa = 0; tentativa < POLL_ATTEMPTS; tentativa++) {
      const { status_code } = await getContainerStatus(credentials.accessToken, containerId)

      if (status_code === 'FINISHED') {
        const published = await publishContainer(credentials.accessToken, credentials.igUserId, containerId)
        await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, {
          status: 'publicado',
          mediaId: published.id,
          publicadoEm: new Date(),
        })
        if (mediaPath) await deleteInstagramPhoto(mediaPath)
        return NextResponse.json({ publicacaoId: publicacao.id, status: 'publicado', mediaId: published.id })
      }

      if (status_code === 'ERROR' || status_code === 'EXPIRED') {
        await atualizarPublicacaoInstagram(session.user.contaId, publicacao.id, { status: 'falhou', erro: `Processamento falhou (${status_code})` })
        if (mediaPath) await deleteInstagramPhoto(mediaPath)
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
    if (mediaPath) await deleteInstagramPhoto(mediaPath)
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
