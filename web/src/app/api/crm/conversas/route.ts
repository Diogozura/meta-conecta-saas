import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarConversas, obterConta } from '@/lib/firestore'
import { obterEtapasFunil } from '@/lib/funil'

// GET /api/crm/conversas - Conversas da conta + colunas do funil, pro board Kanban do CRM leve.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const [conversas, conta] = await Promise.all([
      listarConversas(session.user.contaId),
      obterConta(session.user.contaId),
    ])
    return NextResponse.json({ conversas, etapas: obterEtapasFunil(conta?.funilEtapas) })
  } catch (error) {
    console.error('Erro ao listar conversas do CRM:', error)
    return NextResponse.json({ error: 'Erro ao listar conversas' }, { status: 500 })
  }
}
