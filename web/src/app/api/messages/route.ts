import { auth } from '@/lib/auth'
import { listarMensagensRecebidasDesde, listarFalhasDesde } from '@/lib/firestore'
import { FirestoreQuotaExceededError } from '@/lib/firestoreErrors'
import { quotaErrorResponse } from '@/lib/apiRouteHelpers'

// GET /api/messages?since=<ms> - Polling leve pro painel receber mensagens
// novas do WhatsApp. Antes lia de um store em memória (populado no webhook)
// que não é confiável em produção na Vercel: o webhook e este endpoint podem
// rodar em instâncias serverless diferentes sem memória compartilhada, então
// a mensagem chegava e era salva no Firestore, mas o polling nunca a via.
// Agora lê direto do Firestore, igual ao histórico.
export async function GET(request: Request) {
  let session
  try {
    session = await auth()
  } catch (error) {
    if (error instanceof FirestoreQuotaExceededError) return quotaErrorResponse()
    throw error
  }
  if (!session?.user?.contaId) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const [mensagens, falhas] = await Promise.all([
    listarMensagensRecebidasDesde(session.user.contaId, since),
    listarFalhasDesde(session.user.contaId, since),
  ])
  const messages = mensagens.map((m) => ({ id: m.id, from: m.from, nomeContato: m.nomeContato, text: m.text, timestamp: m.timestamp }))
  // Mensagens ENVIADAS que a Meta aceitou na hora (200 OK) mas depois
  // rejeitou de fato (ex: janela de 24h) — reportado assíncrono, via webhook.
  const failures = falhas.map((m) => ({ id: m.id, erro: m.erro }))

  return Response.json({ messages, failures, serverTime: Date.now() })
}
