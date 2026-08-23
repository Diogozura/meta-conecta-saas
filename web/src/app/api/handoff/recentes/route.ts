import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarTransferenciasRecentes } from '@/lib/firestore'
import { FirestoreQuotaExceededError } from '@/lib/firestoreErrors'
import { quotaErrorResponse } from '@/lib/apiRouteHelpers'

// GET /api/handoff/recentes?since=<ms> - Polling leve pra notificar a empresa
// em tempo real quando a IA transfere uma conversa pra atendimento humano.
// Lê direto do Firestore (campo dataTransferencia em contas/{contaId}/conversas)
// — antes usava um store em memória que não é confiável em produção na Vercel.
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

  const { searchParams } = new URL(req.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const conversas = await listarTransferenciasRecentes(session.user.contaId, since)
  const eventos = conversas.map((c) => ({
    numero: c.numero,
    motivo: c.motivoTransferencia ?? '',
  }))

  return NextResponse.json({ eventos, serverTime: Date.now() })
}
