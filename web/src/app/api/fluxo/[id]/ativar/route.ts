import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterFluxoPorId, ativarFluxo, registrarAuditoria } from '@/lib/firestore'

// POST /api/fluxo/[id]/ativar - Liga esse fluxo e desliga qualquer outro que estivesse ativo
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existente = await obterFluxoPorId(session.user.contaId, id)
  if (!existente) {
    return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })
  }

  try {
    await ativarFluxo(session.user.contaId, id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'fluxo',
      entidadeId: id,
      acao: 'ativar',
      descricao: `Ativou o fluxo "${existente.nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao ativar fluxo:', error)
    return NextResponse.json({ error: 'Erro ao ativar fluxo' }, { status: 500 })
  }
}
