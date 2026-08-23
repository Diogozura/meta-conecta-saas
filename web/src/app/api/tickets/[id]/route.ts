import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterTicket, atualizarTicket } from '@/lib/firestore'
import { validarAtualizacaoTicket } from '@/lib/validarTicket'

// GET /api/tickets/[id] - Detalhe de um ticket
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const ticket = await obterTicket(session.user.contaId, id)
  if (!ticket) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
  }
  return NextResponse.json({ ticket })
}

// PATCH /api/tickets/[id] - Muda status/prioridade/descrição/atendente de um ticket
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const existente = await obterTicket(session.user.contaId, id)
  if (!existente) {
    return NextResponse.json({ error: 'Ticket não encontrado' }, { status: 404 })
  }

  const body = await req.json().catch(() => null)
  const patch = validarAtualizacaoTicket(body)
  if (!patch) {
    return NextResponse.json({ error: 'Atualização inválida' }, { status: 400 })
  }

  try {
    await atualizarTicket(session.user.contaId, id, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar ticket:', error)
    return NextResponse.json({ error: 'Erro ao atualizar ticket' }, { status: 500 })
  }
}
