import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarUsuario, registrarAuditoria } from '@/lib/firestore'

// PATCH /api/atendentes/[id] - Muda o setor do atendente (usado pelo round-robin do Fluxo de atendimento).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body.setor !== 'string') {
    return NextResponse.json({ error: 'setor é obrigatório (string vazia limpa o setor)' }, { status: 400 })
  }

  const setor = body.setor.trim() || null
  try {
    await atualizarUsuario(session.user.contaId, id, { setor })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'atendente',
      entidadeId: id,
      acao: 'atualizar',
      descricao: setor ? `Mudou o setor de um atendente para "${setor}"` : 'Removeu o setor de um atendente',
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar setor do atendente:', error)
    return NextResponse.json({ error: 'Erro ao atualizar setor do atendente' }, { status: 500 })
  }
}
