import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarProfissional, deletarProfissional, obterProfissional } from '@/lib/firestore'
import { sanitizeProfissional } from '@/lib/agendaHelpers'

// GET /api/agenda/profissionais/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const profissional = await obterProfissional(session.user.contaId, id)
  if (!profissional) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ profissional: sanitizeProfissional(profissional) })
}

// PUT /api/agenda/profissionais/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterProfissional(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { nome, telefone, ativo } = body

  try {
    await atualizarProfissional(session.user.contaId, id, { nome, telefone, ativo })
    const updated = await obterProfissional(session.user.contaId, id)
    return NextResponse.json({ profissional: updated ? sanitizeProfissional(updated) : null })
  } catch (error) {
    console.error('Erro ao atualizar profissional:', error)
    return NextResponse.json({ error: 'Erro ao atualizar profissional' }, { status: 500 })
  }
}

// DELETE /api/agenda/profissionais/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existing = await obterProfissional(session.user.contaId, id)
  if (!existing) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
  }

  await deletarProfissional(session.user.contaId, id)
  return NextResponse.json({ ok: true })
}
