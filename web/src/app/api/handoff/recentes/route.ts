import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getHandoffEventsSince } from '@/lib/handoffStore'

// GET /api/handoff/recentes?since=<ms> - Polling leve pra notificar a empresa
// em tempo real quando a IA transfere uma conversa pra atendimento humano.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const eventos = getHandoffEventsSince(session.user.contaId, since)
  return NextResponse.json({ eventos, serverTime: Date.now() })
}
