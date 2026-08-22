import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarDisponibilidade, deletarDisponibilidade, obterDisponibilidade } from '@/lib/firestore'

// PUT /api/agenda/disponibilidades/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterDisponibilidade(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Disponibilidade não encontrada' }, { status: 404 })
  }

  const body = await req.json()
  const { inicio, fim } = body
  if (!inicio || !fim) {
    return NextResponse.json({ error: 'inicio e fim são obrigatórios' }, { status: 400 })
  }

  const inicioDate = new Date(inicio)
  const fimDate = new Date(fim)
  if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime()) || fimDate <= inicioDate) {
    return NextResponse.json({ error: 'Intervalo de data/hora inválido' }, { status: 400 })
  }

  try {
    await atualizarDisponibilidade(session.user.contaId, id, { inicio: inicioDate, fim: fimDate })
    const updated = await obterDisponibilidade(session.user.contaId, id)
    return NextResponse.json({ disponibilidade: updated })
  } catch (error) {
    console.error('Erro ao atualizar disponibilidade:', error)
    return NextResponse.json({ error: 'Erro ao atualizar disponibilidade' }, { status: 500 })
  }
}

// DELETE /api/agenda/disponibilidades/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterDisponibilidade(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Disponibilidade não encontrada' }, { status: 404 })
  }

  try {
    await deletarDisponibilidade(session.user.contaId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover disponibilidade:', error)
    return NextResponse.json({ error: 'Erro ao remover disponibilidade' }, { status: 500 })
  }
}
