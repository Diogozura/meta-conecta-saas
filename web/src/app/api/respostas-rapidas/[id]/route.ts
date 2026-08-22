import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarRespostaRapida, excluirRespostaRapida, registrarAuditoria } from '@/lib/firestore'

// PUT /api/respostas-rapidas/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const atalho = typeof body?.atalho === 'string' ? body.atalho.trim() : ''
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : ''
  if (!atalho || !texto) {
    return NextResponse.json({ error: 'atalho e texto são obrigatórios' }, { status: 400 })
  }

  try {
    await atualizarRespostaRapida(session.user.contaId, id, { atalho, texto })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'resposta_rapida',
      entidadeId: id,
      acao: 'atualizar',
      descricao: `Editou a resposta rápida "/${atalho}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar resposta rápida:', error)
    return NextResponse.json({ error: 'Erro ao atualizar resposta rápida' }, { status: 500 })
  }
}

// DELETE /api/respostas-rapidas/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  try {
    await excluirRespostaRapida(session.user.contaId, id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'resposta_rapida',
      entidadeId: id,
      acao: 'excluir',
      descricao: 'Removeu uma resposta rápida',
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir resposta rápida:', error)
    return NextResponse.json({ error: 'Erro ao excluir resposta rápida' }, { status: 500 })
  }
}
