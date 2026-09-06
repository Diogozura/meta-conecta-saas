import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarComentariosInstagram } from '@/lib/firestore'
import { getInstagramCredentials, listConversations, listConversationMessages } from '@/lib/instagram'

const MAX_CONVERSAS_BUSCADAS = 15

// GET /api/instagram/search?q=... - Busca por palavra-chave em comentários (histórico persistido)
// e DMs (busca ao vivo, só nas conversas mais recentes — a Graph API não tem endpoint de busca de
// texto, e não guardamos as DMs localmente pra indexar de verdade).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return NextResponse.json({ error: 'Digite ao menos 2 caracteres pra buscar.' }, { status: 400 })
  }

  try {
    const credentials = await getInstagramCredentials()

    const [comentarios, conversas] = await Promise.all([
      buscarComentariosInstagram(session.user.contaId, q).catch(() => []),
      listConversations(credentials.accessToken, credentials.igUserId).catch(() => []),
    ])

    const qLower = q.toLowerCase()
    const mensagensEncontradas: { conversationId: string; participante?: string; mensagem: string; createdTime?: string }[] = []
    for (const conversa of conversas.slice(0, MAX_CONVERSAS_BUSCADAS)) {
      const { mensagens } = await listConversationMessages(credentials.accessToken, conversa.id).catch(() => ({ mensagens: [] }))
      const participante = conversa.participants?.data?.find((p) => p.id !== credentials.igUserId)?.username
      for (const m of mensagens) {
        if (m.message?.toLowerCase().includes(qLower)) {
          mensagensEncontradas.push({ conversationId: conversa.id, participante, mensagem: m.message, createdTime: m.created_time })
        }
      }
    }

    return NextResponse.json({
      comentarios,
      mensagens: mensagensEncontradas,
      conversasBuscadas: Math.min(conversas.length, MAX_CONVERSAS_BUSCADAS),
      totalConversas: conversas.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
