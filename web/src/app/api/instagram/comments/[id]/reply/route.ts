import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, replyToComment, InstagramApiError } from '@/lib/instagram'
import { marcarComentarioRespondido } from '@/lib/firestore'

// POST /api/instagram/comments/[id]/reply - Responde um comentário
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: { message?: string; mediaId?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.message) {
    return NextResponse.json({ error: 'Campo "message" é obrigatório' }, { status: 400 })
  }

  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const credentials = await getInstagramCredentials()
    const result = await replyToComment(credentials.accessToken, id, body.message)

    if (body.mediaId) {
      try {
        await marcarComentarioRespondido(session.user.contaId, body.mediaId, id)
      } catch (persistError) {
        console.error('Erro ao marcar comentário como respondido no Firestore:', persistError)
      }
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
