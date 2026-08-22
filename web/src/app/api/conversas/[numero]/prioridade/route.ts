import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { definirPrioridadeConversa } from '@/lib/firestore'

const PRIORIDADES_VALIDAS = new Set(['normal', 'alta', 'urgente'])

// PATCH /api/conversas/[numero]/prioridade - Muda a prioridade da conversa na fila (manual — sobrepõe a detecção automática por tag VIP).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params
  const body = await req.json().catch(() => null)
  const prioridade = body?.prioridade
  if (typeof prioridade !== 'string' || !PRIORIDADES_VALIDAS.has(prioridade)) {
    return NextResponse.json({ error: "prioridade deve ser 'normal', 'alta' ou 'urgente'" }, { status: 400 })
  }

  try {
    await definirPrioridadeConversa(session.user.contaId, numero, prioridade as 'normal' | 'alta' | 'urgente')
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar prioridade da conversa:', error)
    return NextResponse.json({ error: 'Erro ao atualizar prioridade' }, { status: 500 })
  }
}
