import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarConta, obterConta } from '@/lib/firestore'
import { PLANO_SERVICOS, SERVICOS_PADRAO } from '@/lib/servicos'
import type { PlanoTipo } from '@/types/database'

const PLANOS_VALIDOS: PlanoTipo[] = ['base', 'medio', 'premium']

// PATCH /api/conta/plano - Troca o plano da PRÓPRIA conta logada (self-service, sem precisar de
// admin de plataforma) — usado pela aba "Plano" em Configurações. Demonstrativo: aplica
// automaticamente os módulos de WhatsApp/Instagram do plano escolhido (ver PLANO_SERVICOS), não
// mexe em cobrança nem em quantidade de números/contas conectadas.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const plano = body?.plano as PlanoTipo
  if (!PLANOS_VALIDOS.includes(plano)) {
    return NextResponse.json({ error: 'Plano inválido' }, { status: 400 })
  }

  try {
    const conta = await obterConta(session.user.contaId)
    const servicosAtuais = conta?.servicosContratados ?? SERVICOS_PADRAO
    const servicosContratados = { ...servicosAtuais, ...PLANO_SERVICOS[plano] }

    await atualizarConta(session.user.contaId, { plano, servicosContratados })
    return NextResponse.json({ ok: true, plano, servicosContratados })
  } catch (error) {
    console.error('Erro ao trocar o plano da conta:', error)
    return NextResponse.json({ error: 'Erro ao trocar o plano' }, { status: 500 })
  }
}
