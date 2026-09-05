import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarModeloLegenda, excluirModeloLegenda, registrarAuditoria } from '@/lib/firestore'

// PUT /api/caption-templates/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const gancho = typeof body?.gancho === 'string' ? body.gancho.trim() : ''
  const corpo = typeof body?.corpo === 'string' ? body.corpo.trim() : ''
  const cta = typeof body?.cta === 'string' ? body.cta.trim() : ''
  if (!nome || (!gancho && !corpo && !cta)) {
    return NextResponse.json({ error: 'Informe um nome e pelo menos um dos campos (gancho, corpo ou CTA)' }, { status: 400 })
  }

  try {
    await atualizarModeloLegenda(session.user.contaId, id, { nome, gancho, corpo, cta })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'modelo_legenda',
      entidadeId: id,
      acao: 'atualizar',
      descricao: `Editou o modelo de legenda "${nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar modelo de legenda:', error)
    return NextResponse.json({ error: 'Erro ao atualizar modelo de legenda' }, { status: 500 })
  }
}

// DELETE /api/caption-templates/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  try {
    await excluirModeloLegenda(session.user.contaId, id)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'modelo_legenda',
      entidadeId: id,
      acao: 'excluir',
      descricao: 'Removeu um modelo de legenda',
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir modelo de legenda:', error)
    return NextResponse.json({ error: 'Erro ao excluir modelo de legenda' }, { status: 500 })
  }
}
