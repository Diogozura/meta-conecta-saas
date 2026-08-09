import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getAgendamentoEventsSince } from '@/lib/agendamentoStore'

// GET /api/agenda/agendamentos/recentes?since=<ms> - Polling leve para notificar
// a empresa em tempo real sobre novos agendamentos (usado por RealtimeListeners).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const eventos = getAgendamentoEventsSince(session.user.contaId, since)
  return NextResponse.json({ eventos, serverTime: Date.now() })
}
