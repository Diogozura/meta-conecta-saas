import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { desbloquearUsuarioInstagram, registrarAuditoria } from '@/lib/firestore'

// DELETE /api/instagram/bloqueados/[username] - Desbloqueia
export async function DELETE(_req: Request, { params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    await desbloquearUsuarioInstagram(session.user.contaId, username)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_conta',
      acao: 'excluir',
      descricao: `Desbloqueou @${username}`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao desbloquear usuário do Instagram:', error)
    return NextResponse.json({ error: 'Erro ao desbloquear usuário' }, { status: 500 })
  }
}
