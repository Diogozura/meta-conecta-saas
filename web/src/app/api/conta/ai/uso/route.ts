import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterUsoAgenteIA } from '@/lib/firestore'

// GET /api/conta/ai/uso - Contador próprio de quantas vezes o agente de IA
// respondeu (hoje / mês / últimos 30 dias). Não é a cota oficial do provedor
// (Gemini/OpenAI/Anthropic não expõem isso pela chave de API comum) — serve
// como referência prática pra comparar com o limite conhecido do plano.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const hoje = new Date()
  const chaveHoje = hoje.toISOString().slice(0, 10)
  const de = new Date(hoje)
  de.setDate(de.getDate() - 29)
  const chaveDe = de.toISOString().slice(0, 10)

  try {
    const dias = await obterUsoAgenteIA(session.user.contaId, chaveDe, chaveHoje)
    const totalHoje = dias.find((d) => d.data === chaveHoje)?.total ?? 0
    const chaveInicioMes = `${chaveHoje.slice(0, 7)}-01`
    const totalMes = dias.filter((d) => d.data >= chaveInicioMes).reduce((soma, d) => soma + d.total, 0)
    const total30Dias = dias.reduce((soma, d) => soma + d.total, 0)

    return NextResponse.json({ hoje: totalHoje, mes: totalMes, ultimos30Dias: total30Dias })
  } catch (error) {
    console.error('Erro ao carregar uso do agente de IA:', error)
    return NextResponse.json({ error: 'Erro ao carregar uso do agente de IA' }, { status: 500 })
  }
}
