import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, getContainerStatus, publishContainer, InstagramApiError } from '@/lib/instagram'
import { obterPublicacaoInstagram, atualizarPublicacaoInstagram } from '@/lib/firestore'
import { deleteInstagramPhoto } from '@/lib/storage'

// GET /api/instagram/publications/[id] - Consulta (e finaliza, se pronto) uma publicação
// ainda "processando" — o compositor faz polling nesse endpoint enquanto vídeo/reels
// terminam de processar na Meta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const publicacao = await obterPublicacaoInstagram(session.user.contaId, id)
  if (!publicacao) {
    return NextResponse.json({ error: 'Publicação não encontrada' }, { status: 404 })
  }

  if (publicacao.status !== 'processando' || !publicacao.containerId) {
    return NextResponse.json({ publicacao })
  }

  try {
    const credentials = await getInstagramCredentials()
    const { status_code } = await getContainerStatus(credentials.accessToken, publicacao.containerId)

    if (status_code === 'FINISHED') {
      const published = await publishContainer(credentials.accessToken, credentials.igUserId, publicacao.containerId)
      await atualizarPublicacaoInstagram(session.user.contaId, id, { status: 'publicado', mediaId: published.id, publicadoEm: new Date() })
      if (publicacao.mediaPath) await deleteInstagramPhoto(publicacao.mediaPath)
      await Promise.all((publicacao.mediaPaths ?? []).map((p) => deleteInstagramPhoto(p)))
      if (publicacao.coverPath) await deleteInstagramPhoto(publicacao.coverPath)
      return NextResponse.json({ publicacao: { ...publicacao, status: 'publicado', mediaId: published.id } })
    }

    if (status_code === 'ERROR' || status_code === 'EXPIRED') {
      const erro = `Processamento falhou (${status_code})`
      await atualizarPublicacaoInstagram(session.user.contaId, id, { status: 'falhou', erro })
      if (publicacao.mediaPath) await deleteInstagramPhoto(publicacao.mediaPath)
      await Promise.all((publicacao.mediaPaths ?? []).map((p) => deleteInstagramPhoto(p)))
      if (publicacao.coverPath) await deleteInstagramPhoto(publicacao.coverPath)
      return NextResponse.json({ publicacao: { ...publicacao, status: 'falhou', erro } })
    }

    return NextResponse.json({ publicacao })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
