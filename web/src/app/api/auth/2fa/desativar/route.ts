import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterUsuario, desativarTotp, registrarAuditoria } from '@/lib/firestore'
import { validarCodigoTotp } from '@/lib/totp'

// POST /api/auth/2fa/desativar - Desliga o 2FA — exige o código atual (mesmo já logado) por segurança extra.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId || !session.user.usuarioId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const codigo = typeof body?.codigo === 'string' ? body.codigo : ''

  const usuario = await obterUsuario(session.user.contaId, session.user.usuarioId)
  if (!usuario?.totpAtivo || !usuario.totpSecret) {
    return NextResponse.json({ error: '2FA não está ativo' }, { status: 400 })
  }
  if (!validarCodigoTotp(usuario.totpSecret, codigo)) {
    return NextResponse.json({ error: 'Código incorreto' }, { status: 400 })
  }

  await desativarTotp(session.user.contaId, session.user.usuarioId)
  await registrarAuditoria(session.user.contaId, {
    entidade: 'atendente',
    entidadeId: session.user.usuarioId,
    acao: 'atualizar',
    descricao: 'Desativou a autenticação em dois fatores (2FA) na própria conta',
    usuarioId: session.user.usuarioId,
    usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
