import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterMetaAccess } from '@/lib/firestore'
import { getMediaInfo, downloadMedia, MetaApiError } from '@/lib/meta'

/**
 * GET /api/whatsapp/midia/[mediaId] - Proxy autenticado pra mídia do
 * WhatsApp (foto, áudio, vídeo, documento, figurinha). Sem Firebase Storage
 * (exige plano pago) a mídia nunca fica guardada aqui — o Firestore só tem o
 * `mediaId`, e essa rota busca os bytes na Meta a cada visualização
 * (com cache de 1h no navegador pra não repetir a cada render).
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { mediaId } = await params

  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    return NextResponse.json({ error: 'WhatsApp não conectado' }, { status: 404 })
  }

  try {
    const info = await getMediaInfo(mediaId, metaAccess.businessToken)
    const { buffer, mimeType } = await downloadMedia(info.url, metaAccess.businessToken)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (error) {
    // Mídia recebida fica disponível na Meta só por um tempo limitado — uma
    // conversa muito antiga pode legitimamente não ter mais o arquivo lá.
    const status = error instanceof MetaApiError ? 404 : 500
    console.error('Erro ao buscar mídia do WhatsApp:', error)
    return NextResponse.json({ error: 'Mídia indisponível (pode ter expirado na Meta)' }, { status })
  }
}
