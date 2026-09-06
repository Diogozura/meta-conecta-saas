import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarAtividadeInstagramRecente } from '@/lib/firestore'

// GET /api/instagram/activity/recentes?since=<ms> - Comentários/menções novos desde `since`,
// usado pro toast em tempo real (ver RealtimeListeners) — complementa o resumo semanal por
// e-mail, que só avisa uma vez por semana.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const since = Number(req.nextUrl.searchParams.get('since'))
  const serverTime = Date.now()
  if (!Number.isFinite(since)) {
    return NextResponse.json({ comentarios: [], mencoes: [], serverTime })
  }

  try {
    const { comentarios, mencoes } = await listarAtividadeInstagramRecente(session.user.contaId, since)
    return NextResponse.json({ comentarios, mencoes, serverTime })
  } catch (error) {
    console.error('Erro ao buscar atividade recente do Instagram:', error)
    return NextResponse.json({ comentarios: [], mencoes: [], serverTime })
  }
}
