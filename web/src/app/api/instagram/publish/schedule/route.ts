import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials } from '@/lib/instagram'
import { criarPublicacaoInstagram } from '@/lib/firestore'
import { uploadInstagramMedia } from '@/lib/storage'
import type { PublicacaoInstagramMediaItem } from '@/types/database'

const MIN_CAROUSEL_ITEMS = 2
const MAX_CAROUSEL_ITEMS = 10
const MAX_COLLABORATORS = 3

type Tipo = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

// POST /api/instagram/publish/schedule - Salva um rascunho (sem `agendadoPara`) ou agenda
// uma publicação pra data futura (com `agendadoPara`). Diferente de /publish, não cria
// container na Meta agora — só sobe o(s) arquivo(s) pro Blob (containers não publicados
// expiram em 24h na API da Meta, então criar antecipado não funcionaria pra agendamentos
// distantes). O container de verdade é criado na hora certa por `criarContainerDeAgendamento`
// (cron ou ação "publicar agora").
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
  const agendadoParaRaw = formData.get('agendadoPara')
  const agendadoPara = typeof agendadoParaRaw === 'string' && agendadoParaRaw ? new Date(agendadoParaRaw) : undefined

  if (!tipo || files.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos um arquivo.' }, { status: 400 })
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
  if (agendadoPara && Number.isNaN(agendadoPara.getTime())) {
    return NextResponse.json({ error: 'Data de agendamento inválida.' }, { status: 400 })
  }
  if (agendadoPara && agendadoPara.getTime() < Date.now()) {
    return NextResponse.json({ error: 'A data de agendamento precisa ser no futuro.' }, { status: 400 })
  }

  try {
    // Só pra confirmar que a conta tem o Instagram conectado antes de subir arquivo à toa.
    await getInstagramCredentials()

    const mediaItems: PublicacaoInstagramMediaItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isVideo = file.type.startsWith('video/')
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadInstagramMedia(contaId, buffer, file.type, String(i))
      mediaItems.push({ url: uploaded.url, path: uploaded.path, isVideo })
    }

    let coverItem: { url: string; path: string } | undefined
    if (tipo === 'REELS' && coverFile instanceof File) {
      const buffer = Buffer.from(await coverFile.arrayBuffer())
      coverItem = await uploadInstagramMedia(contaId, buffer, coverFile.type, 'cover')
    }

    const publicacao = await criarPublicacaoInstagram(contaId, {
      tipo,
      mediaItems,
      status: agendadoPara ? 'agendado' : 'rascunho',
      ...(tipo === 'CAROUSEL' ? { itemCount: files.length } : {}),
      ...(agendadoPara ? { agendadoPara } : {}),
      ...(caption ? { caption } : {}),
      ...(altText && tipo === 'IMAGE' ? { altText } : {}),
      ...(collaborators.length ? { collaborators } : {}),
      ...(isAiGenerated ? { isAiGenerated } : {}),
      ...(tipo === 'REELS' ? { shareToFeed } : {}),
      ...(coverItem ? { coverItem } : {}),
    })

    return NextResponse.json({ publicacaoId: publicacao.id, status: publicacao.status })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
