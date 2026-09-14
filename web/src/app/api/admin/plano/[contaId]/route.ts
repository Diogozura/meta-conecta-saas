import { NextRequest, NextResponse } from 'next/server'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import { atualizarConta, obterConta } from '@/lib/firestore'
import { PLANO_SERVICOS, SERVICOS_PADRAO } from '@/lib/servicos'
import type { PlanoTipo } from '@/types/database'

const PLANOS_VALIDOS: PlanoTipo[] = ['base', 'medio', 'premium']

// PATCH /api/admin/plano/[contaId] - Define o plano comercial da conta (admin de plataforma) e
// aplica automaticamente os módulos de WhatsApp/Instagram correspondentes (ver PLANO_SERVICOS).
// Demonstrativo: não mexe em quantidade de números/contas conectadas, só liga/desliga o módulo.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contaId: string }> }) {
  const { session, isPlatformAdmin } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { contaId } = await params
  const body = await req.json().catch(() => null)
  const plano = body?.plano as PlanoTipo
  if (!PLANOS_VALIDOS.includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  try {
    const conta = await obterConta(contaId)
    if (!conta) {
      return NextResponse.json({ error: 'Conta não encontrada' }, { status: 404 })
    }

    const servicosAtuais = conta.servicosContratados ?? SERVICOS_PADRAO
    const servicosContratados = { ...servicosAtuais, ...PLANO_SERVICOS[plano] }

    await atualizarConta(contaId, { plano, servicosContratados })
    console.log('[admin/plano] Plano alterado', { contaId, plano, por: session?.email })
    return NextResponse.json({ ok: true, plano, servicosContratados })
  } catch (error) {
    console.error('Erro ao atualizar plano da conta:', error)
    return NextResponse.json({ error: 'Erro ao atualizar plano' }, { status: 500 })
  }
}
