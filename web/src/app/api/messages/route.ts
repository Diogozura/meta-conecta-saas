import { auth } from '@/lib/auth'
import { listarMensagensRecebidasDesde } from '@/lib/firestore'

// GET /api/messages?since=<ms> - Polling leve pro painel receber mensagens
// novas do WhatsApp. Antes lia de um store em memória (populado no webhook)
// que não é confiável em produção na Vercel: o webhook e este endpoint podem
// rodar em instâncias serverless diferentes sem memória compartilhada, então
// a mensagem chegava e era salva no Firestore, mas o polling nunca a via.
// Agora lê direto do Firestore, igual ao histórico.
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const mensagens = await listarMensagensRecebidasDesde(session.user.contaId, since)
  const messages = mensagens.map((m) => ({ id: m.id, from: m.from, nomeContato: m.nomeContato, text: m.text, timestamp: m.timestamp }))

  return Response.json({ messages, serverTime: Date.now() })
}
