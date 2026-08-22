import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarEventosAtendimento, listarAvaliacoesCsat } from '@/lib/firestore'
import { calcularCsat, calcularMetricasHistoricas } from '@/lib/metricasConversas'

// GET /api/conversas/metricas/historico?dias=7 - Métricas históricas por setor (espera/atendimento reais, não fotografia) + CSAT/NPS.
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const dias = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('dias') ?? '7', 10) || 7, 1), 90)
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

  try {
    const [eventos, avaliacoes] = await Promise.all([
      listarEventosAtendimento(session.user.contaId, desde),
      listarAvaliacoesCsat(session.user.contaId, desde),
    ])
    const metricas = calcularMetricasHistoricas(eventos)
    const csat = calcularCsat(avaliacoes)
    return NextResponse.json({ metricas, csat, dias })
  } catch (error) {
    console.error('Erro ao calcular métricas históricas:', error)
    return NextResponse.json({ error: 'Erro ao calcular métricas históricas' }, { status: 500 })
  }
}
