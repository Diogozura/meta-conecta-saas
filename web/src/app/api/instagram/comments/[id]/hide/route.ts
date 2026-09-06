import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, hideComment, InstagramApiError } from '@/lib/instagram'
import { marcarComentarioOculto } from '@/lib/firestore'

// POST /api/instagram/comments/[id]/hide - Oculta (ou reexibe) um comentário manualmente pelo painel.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const hide = body.hide !== false
  const mediaId = typeof body.mediaId === 'string' ? body.mediaId : undefined

  try {
    const credentials = await getInstagramCredentials()
    const result = await hideComment(credentials.accessToken, id, hide)
    if (mediaId) {
      await marcarComentarioOculto(session.user.contaId, mediaId, id, hide, 'Ocultado manualmente pelo painel').catch(() => {})
    }
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
