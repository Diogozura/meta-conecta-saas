import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarConversas } from '@/lib/firestore'
import { calcularMetricasPorSetor } from '@/lib/metricasConversas'

// GET /api/conversas/metricas - Fotografia ao vivo da fila humana por setor (não é histórico).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const conversas = await listarConversas(session.user.contaId)
    const metricas = calcularMetricasPorSetor(conversas)
    return NextResponse.json({ metricas })
  } catch (error) {
    console.error('Erro ao calcular métricas de conversas:', error)
    return NextResponse.json({ error: 'Erro ao calcular métricas' }, { status: 500 })
  }
}
