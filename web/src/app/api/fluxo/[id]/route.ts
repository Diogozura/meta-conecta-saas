import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterFluxoPorId, atualizarFluxo, excluirFluxo, registrarAuditoria } from '@/lib/firestore'
import { validarFluxo } from '../route'

// GET /api/fluxo/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const fluxo = await obterFluxoPorId(session.user.contaId, id)
  if (!fluxo) {
    return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })
  }
  return NextResponse.json({ fluxo })
}

// PUT /api/fluxo/[id] - Substitui o conteúdo de um fluxo existente
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existente = await obterFluxoPorId(session.user.contaId, id)
  if (!existente) {
    return NextResponse.json({ error: 'Fluxo não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const dados = validarFluxo(body)
  if (!dados) {
    return NextResponse.json({ error: 'Fluxo inválido — precisa de nome, um nó "inicio" e nodes/edges bem formados' }, { status: 400 })
  }

  try {
    const fluxo = await atualizarFluxo(session.user.contaId, id, dados)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'fluxo',
      entidadeId: fluxo.id,
      acao: 'atualizar',
      descricao: `Editou o fluxo "${fluxo.nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ fluxo })
  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error)
    return NextResponse.json({ error: 'Erro ao atualizar fluxo' }, { status: 500 })
  }
}

// DELETE /api/fluxo/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
    await excluirFluxo(session.user.contaId, id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'fluxo',
      entidadeId: id,
      acao: 'excluir',
      descricao: `Removeu o fluxo "${existente.nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover fluxo:', error)
    return NextResponse.json({ error: 'Erro ao remover fluxo' }, { status: 500 })
  }
}
