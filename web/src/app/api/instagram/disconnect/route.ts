import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterInstagramAccess, excluirInstagramAccess, registrarAuditoria } from '@/lib/firestore'

export async function POST() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const existing = await obterInstagramAccess(session.user.contaId)
  if (existing) {
    await excluirInstagramAccess(session.user.contaId, existing.id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_conta',
      acao: 'excluir',
      descricao: `Desconectou a conta do Instagram (@${existing.username})`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
  }

  return NextResponse.json({ success: true })
}
