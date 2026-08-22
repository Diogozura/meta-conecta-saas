import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getInstagramCredentials, sendDirectMessage, InstagramApiError } from '@/lib/instagram'
import { criarMensagemInstagram, listarMensagensInstagramRecebidasDesde } from '@/lib/firestore'

// GET /api/instagram/messages?since=<ms> - Polling leve pro painel: mensagens novas
// (persistidas pelo webhook), mesmo padrão de GET /api/messages (WhatsApp).
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const mensagens = await listarMensagensInstagramRecebidasDesde(session.user.contaId, since)
  return NextResponse.json({ messages: mensagens, serverTime: Date.now() })
}

// POST /api/instagram/messages - Envia uma resposta de DM
export async function POST(request: NextRequest) {
  let body: { recipientId?: string; conversationId?: string; text?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.recipientId || !body.text) {
    return NextResponse.json({ error: 'Campos "recipientId" e "text" são obrigatórios' }, { status: 400 })
  }

  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const credentials = await getInstagramCredentials()
    const result = await sendDirectMessage(credentials.accessToken, body.recipientId, body.text)

    try {
      await criarMensagemInstagram({
        id: result.message_id,
        contaId: session.user.contaId,
        conversationId: body.conversationId ?? body.recipientId,
        from: credentials.igUserId,
        to: body.recipientId,
        text: body.text,
        timestamp: Math.floor(Date.now() / 1000),
        tipo: 'enviada',
      })
    } catch (persistError) {
      console.error('Erro ao salvar DM enviada no Firestore:', persistError)
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
