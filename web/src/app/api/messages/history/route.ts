import { auth } from '@/lib/auth'
import { listarMensagens } from '@/lib/firestore'

// GET /api/messages/history - Histórico persistido no Firestore (enviadas + recebidas)
// Diferente de /api/messages (polling em memória, só recebidas e perdido a
// cada reinício do servidor) — usado pra reconstruir as conversas ao abrir
// a tela, já que localStorage sozinho não sobrevive a outro navegador/dispositivo.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return Response.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const mensagens = await listarMensagens(session.user.contaId, 500)
  return Response.json({ mensagens })
}
