import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarAgendamentosRecentes, obterProfissional } from '@/lib/firestore'
import { FirestoreQuotaExceededError } from '@/lib/firestoreErrors'
import { quotaErrorResponse } from '@/lib/apiRouteHelpers'

// GET /api/agenda/agendamentos/recentes?since=<ms> - Polling leve para notificar
// a empresa em tempo real sobre novos agendamentos (usado por RealtimeListeners).
// Lê direto do Firestore — antes usava um store em memória que não é confiável
// em produção na Vercel (webhook e polling podem cair em instâncias diferentes).
export async function GET(req: NextRequest) {
  let session
  try {
    session = await auth()
  } catch (error) {
    if (error instanceof FirestoreQuotaExceededError) return quotaErrorResponse(error)
    throw error
  }
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const { searchParams } = new URL(req.url)
  const since = parseInt(searchParams.get('since') ?? '0', 10)
  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json({ error: 'since deve ser um timestamp em milissegundos válido' }, { status: 400 })
  }

  try {
    const agendamentos = await listarAgendamentosRecentes(contaId, since)
    const eventos = await Promise.all(
      agendamentos.map(async (a) => {
        const profissional = await obterProfissional(contaId, a.profissionalId)
        return {
          id: a.id,
          clienteNome: a.clienteNome,
          profissionalNome: profissional?.nome ?? 'profissional',
          inicio: a.inicio,
        }
      }),
    )

    return NextResponse.json({ eventos, serverTime: Date.now() })
  } catch (error) {
    if (error instanceof FirestoreQuotaExceededError) return quotaErrorResponse(error)
    console.error('Erro ao buscar agendamentos recentes:', error)
    return NextResponse.json({ error: 'Erro ao buscar agendamentos recentes' }, { status: 500 })
  }
}
