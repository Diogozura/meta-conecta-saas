import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials } from '@/lib/instagram'
import { criarPublicacaoInstagram } from '@/lib/firestore'
import { uploadInstagramMedia } from '@/lib/storage'

const MAX_ITENS_LOTE = 30
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

// POST /api/instagram/publish/schedule/batch - Cria vários agendamentos de uma vez, um por
// arquivo, espaçados por `intervaloDias` a partir de `primeiraData`. V1: só imagens avulsas
// (sem carrossel/vídeo/recorte), uma legenda compartilhada opcional entre todos os itens.
// Cada item vira um PublicacaoInstagram 'agendado' normal — o cron de agendamento já existente
// (api/cron/instagram-publicacoes) publica cada um na hora certa, sem nenhuma mudança nele.
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const formData = await request.formData()
  const files = formData.getAll('files').filter((f): f is File => f instanceof File)
  const captionRaw = formData.get('caption')
  const caption = typeof captionRaw === 'string' && captionRaw.trim() ? captionRaw.trim() : undefined
  const primeiraDataRaw = formData.get('primeiraData')
  const intervaloDiasRaw = formData.get('intervaloDias')
  const intervaloDias = Number(intervaloDiasRaw) || 1

  if (files.length === 0) {
    return NextResponse.json({ error: 'Selecione ao menos uma imagem.' }, { status: 400 })
  }
  if (files.length > MAX_ITENS_LOTE) {
    return NextResponse.json({ error: `Máximo de ${MAX_ITENS_LOTE} imagens por lote.` }, { status: 400 })
  }
  for (const file of files) {
    if (!SUPPORTED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Só imagens JPEG/PNG são aceitas na importação em lote.' }, { status: 400 })
    }
  }
  const primeiraData = typeof primeiraDataRaw === 'string' ? new Date(primeiraDataRaw) : null
  if (!primeiraData || Number.isNaN(primeiraData.getTime())) {
    return NextResponse.json({ error: 'Escolha a data do primeiro post.' }, { status: 400 })
  }
  if (primeiraData.getTime() < Date.now()) {
    return NextResponse.json({ error: 'A data do primeiro post precisa ser no futuro.' }, { status: 400 })
  }

  try {
    await getInstagramCredentials()

    const criadas = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const buffer = Buffer.from(await file.arrayBuffer())
      const uploaded = await uploadInstagramMedia(contaId, buffer, file.type, `lote-${i}`)
      const agendadoPara = new Date(primeiraData.getTime() + i * intervaloDias * 24 * 60 * 60 * 1000)

      const publicacao = await criarPublicacaoInstagram(contaId, {
        tipo: 'IMAGE',
        status: 'agendado',
        agendadoPara,
        mediaItems: [{ url: uploaded.url, path: uploaded.path, isVideo: false }],
        ...(caption ? { caption } : {}),
      })
      criadas.push({ id: publicacao.id, agendadoPara })
    }

    return NextResponse.json({ criadas })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
