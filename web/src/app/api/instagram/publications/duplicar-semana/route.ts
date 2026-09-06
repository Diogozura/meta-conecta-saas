import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarPublicacoesInstagramAgendadasNoPeriodo, criarPublicacaoInstagram, registrarAuditoria } from '@/lib/firestore'
import { uploadInstagramMedia } from '@/lib/storage'
import { agendarPublicacaoExata } from '@/lib/qstash'
import type { PublicacaoInstagramMediaItem } from '@/types/database'

const UMA_SEMANA_MS = 7 * 24 * 60 * 60 * 1000

function extensaoParaContentType(path: string, isVideo: boolean): string {
  if (isVideo) return path.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4'
  return path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
}

/** Baixa a mídia já hospedada e sobe uma cópia NOVA e independente — nunca reusa o mesmo blob
 * entre duas publicações (uma delas apagar o arquivo depois de publicar derrubaria a outra). */
async function duplicarMedia(contaId: string, item: { url: string; path: string }, isVideo: boolean, suffix: string) {
  const res = await fetch(item.url)
  if (!res.ok) throw new Error(`Falha ao baixar mídia original (${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  const contentType = extensaoParaContentType(item.path, isVideo)
  return uploadInstagramMedia(contaId, buffer, contentType, suffix)
}

// POST /api/instagram/publications/duplicar-semana - Duplica todos os agendamentos de uma semana
// (7 dias a partir de `inicio`) pra semana seguinte (+7 dias cada), com cópia independente da mídia.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const body = await req.json().catch(() => ({}))
  const inicio = typeof body.inicio === 'string' ? new Date(body.inicio) : null
  if (!inicio || Number.isNaN(inicio.getTime())) {
    return NextResponse.json({ error: 'Data de início da semana inválida' }, { status: 400 })
  }
  const fim = new Date(inicio.getTime() + UMA_SEMANA_MS)

  try {
    const origem = await listarPublicacoesInstagramAgendadasNoPeriodo(contaId, inicio, fim)
    const criadas: string[] = []
    const erros: string[] = []

    for (const original of origem) {
      try {
        const mediaItems: PublicacaoInstagramMediaItem[] = await Promise.all(
          (original.mediaItems ?? []).map(async (m, i) => {
            const dup = await duplicarMedia(contaId, m, m.isVideo, `dup-${Date.now()}-${i}`)
            return { url: dup.url, path: dup.path, isVideo: m.isVideo }
          }),
        )
        let coverItem: { url: string; path: string } | undefined
        if (original.coverItem) {
          coverItem = await duplicarMedia(contaId, original.coverItem, false, `dup-cover-${Date.now()}`)
        }

        const novaData = new Date(new Date(original.agendadoPara!).getTime() + UMA_SEMANA_MS)
        const nova = await criarPublicacaoInstagram(contaId, {
          tipo: original.tipo,
          mediaItems,
          status: 'agendado',
          agendadoPara: novaData,
          direitosAutoraisConfirmado: true,
          ...(original.caption ? { caption: original.caption } : {}),
          ...(original.altText ? { altText: original.altText } : {}),
          ...(original.collaborators?.length ? { collaborators: original.collaborators } : {}),
          ...(original.isAiGenerated ? { isAiGenerated: original.isAiGenerated } : {}),
          ...(original.tipo === 'REELS' ? { shareToFeed: original.shareToFeed } : {}),
          ...(original.itemCount ? { itemCount: original.itemCount } : {}),
          ...(coverItem ? { coverItem } : {}),
        })
        await agendarPublicacaoExata(contaId, nova.id, novaData)
        criadas.push(nova.id)
      } catch (err) {
        erros.push(`${original.id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    await registrarAuditoria(contaId, {
      entidade: 'instagram_publicacao',
      acao: 'criar',
      descricao: `Duplicou a semana de ${inicio.toLocaleDateString('pt-BR')} pra semana seguinte — ${criadas.length} publicação(ões) criada(s)`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})

    return NextResponse.json({ criadas: criadas.length, erros })
  } catch (error) {
    console.error('Erro ao duplicar semana de publicações:', error)
    return NextResponse.json({ error: 'Erro ao duplicar semana' }, { status: 500 })
  }
}
