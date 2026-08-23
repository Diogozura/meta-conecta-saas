import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterConta, atualizarConta } from '@/lib/firestore'
import { obterEtapasFunil, validarFunilEtapas } from '@/lib/funil'

// GET /api/conta/funil-etapas - Colunas do Kanban do CRM leve da PRÓPRIA conta (custom ou padrão).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const conta = await obterConta(session.user.contaId)
  return NextResponse.json({ etapas: obterEtapasFunil(conta?.funilEtapas) })
}

// PUT /api/conta/funil-etapas - Substitui a lista de etapas do funil da conta (renomear, reordenar, adicionar/remover colunas).
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const etapas = validarFunilEtapas(body?.etapas)
  if (!etapas) {
    return NextResponse.json({ error: 'Lista de etapas inválida — cada uma precisa de id, nome e cor (#rrggbb) únicos' }, { status: 400 })
  }

  try {
    await atualizarConta(session.user.contaId, { funilEtapas: etapas })
    return NextResponse.json({ etapas })
  } catch (error) {
    console.error('Erro ao salvar etapas do funil:', error)
    return NextResponse.json({ error: 'Erro ao salvar etapas do funil' }, { status: 500 })
  }
}
