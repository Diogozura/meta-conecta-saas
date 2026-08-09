import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarServico, deletarServico, obterServico } from '@/lib/firestore'

// GET /api/agenda/servicos/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const servico = await obterServico(session.user.contaId, id)
  if (!servico) {
    return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ servico })
}

// PUT /api/agenda/servicos/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterServico(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { nome, duracaoMinutos, profissionalIds, ativo } = body

  try {
    await atualizarServico(session.user.contaId, id, { nome, duracaoMinutos, profissionalIds, ativo })
    const updated = await obterServico(session.user.contaId, id)
    return NextResponse.json({ servico: updated })
  } catch (error) {
    console.error('Erro ao atualizar serviço:', error)
    return NextResponse.json({ error: 'Erro ao atualizar serviço' }, { status: 500 })
  }
}

// DELETE /api/agenda/servicos/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterServico(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
  }

  await deletarServico(session.user.contaId, id)
  return NextResponse.json({ ok: true })
}
