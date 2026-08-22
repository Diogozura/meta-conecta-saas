import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { excluirDadosCliente, registrarAuditoria } from '@/lib/firestore'
import { NivelUsuario } from '@/types/database'

/**
 * DELETE /api/conversas/[numero]/lgpd - Apaga TODOS os dados desse número
 * (mensagens, conversa, avaliações de CSAT, cadastro de cliente) —
 * irreversível, direito de eliminação da LGPD (art. 18, VI). Restrito a
 * proprietário/admin dado o tamanho do estrago se usado por engano.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (session.user.nivel !== NivelUsuario.PROPRIETARIO && session.user.nivel !== NivelUsuario.ADMIN) {
    return NextResponse.json({ error: 'Só administradores podem excluir dados de um cliente.' }, { status: 403 })
  }

  const { numero } = await params

  try {
    const resultado = await excluirDadosCliente(session.user.contaId, numero)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'dados_cliente',
      entidadeId: numero.replace(/\D/g, ''),
      acao: 'excluir',
      descricao: `Excluiu todos os dados do número ${numero} (LGPD) — ${resultado.mensagensApagadas} mensagens apagadas`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    console.error('Erro ao excluir dados do cliente:', error)
    return NextResponse.json({ error: 'Erro ao excluir dados do cliente' }, { status: 500 })
  }
}
