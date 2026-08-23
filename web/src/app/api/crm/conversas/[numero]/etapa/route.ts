import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { moverConversaEtapaFunil, obterConta } from '@/lib/firestore'
import { obterEtapasFunil } from '@/lib/funil'

// PATCH /api/crm/conversas/[numero]/etapa - Move a conversa pra outra coluna do Kanban do CRM leve (drag-and-drop no board).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params
  const body = await req.json().catch(() => null)
  const etapaFunilId = body?.etapaFunilId
  if (typeof etapaFunilId !== 'string' || !etapaFunilId.trim()) {
    return NextResponse.json({ error: 'etapaFunilId é obrigatório' }, { status: 400 })
  }

  const conta = await obterConta(session.user.contaId)
  const etapas = obterEtapasFunil(conta?.funilEtapas)
  if (!etapas.some((e) => e.id === etapaFunilId)) {
    return NextResponse.json({ error: 'Essa etapa não existe mais no funil dessa conta' }, { status: 400 })
  }

  try {
    await moverConversaEtapaFunil(session.user.contaId, numero, etapaFunilId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao mover conversa de etapa no CRM:', error)
    return NextResponse.json({ error: 'Erro ao mover a conversa' }, { status: 500 })
  }
}
