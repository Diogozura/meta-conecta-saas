import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarConjuntoHashtags, excluirConjuntoHashtags, registrarAuditoria } from '@/lib/firestore'

// PUT /api/hashtag-sets/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const hashtags = typeof body?.hashtags === 'string' ? body.hashtags.trim() : ''
  if (!nome || !hashtags) {
    return NextResponse.json({ error: 'nome e hashtags são obrigatórios' }, { status: 400 })
  }

  try {
    await atualizarConjuntoHashtags(session.user.contaId, id, { nome, hashtags })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'conjunto_hashtags',
      entidadeId: id,
      acao: 'atualizar',
      descricao: `Editou o conjunto de hashtags "${nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar conjunto de hashtags:', error)
    return NextResponse.json({ error: 'Erro ao atualizar conjunto de hashtags' }, { status: 500 })
  }
}

// DELETE /api/hashtag-sets/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  try {
    await excluirConjuntoHashtags(session.user.contaId, id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'conjunto_hashtags',
      entidadeId: id,
      acao: 'excluir',
      descricao: 'Removeu um conjunto de hashtags',
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir conjunto de hashtags:', error)
    return NextResponse.json({ error: 'Erro ao excluir conjunto de hashtags' }, { status: 500 })
  }
}
