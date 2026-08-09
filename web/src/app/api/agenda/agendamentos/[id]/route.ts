import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarAgendamento, obterAgendamento, obterProfissional } from '@/lib/firestore'
import { deleteCalendarEvent } from '@/lib/googleCalendar'

// GET /api/agenda/agendamentos/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const agendamento = await obterAgendamento(session.user.contaId, id)
  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  return NextResponse.json({ agendamento })
}

// PATCH /api/agenda/agendamentos/[id] - Muda o status (ex: cancelar/concluir).
// Ao cancelar, remove também o evento correspondente no Google Calendar.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const agendamento = await obterAgendamento(session.user.contaId, id)
  if (!agendamento) {
    return NextResponse.json({ error: 'Agendamento não encontrado' }, { status: 404 })
  }

  const body = await req.json()
  const { status } = body as { status?: 'confirmado' | 'cancelado' | 'concluido' }
  if (!status || !['confirmado', 'cancelado', 'concluido'].includes(status)) {
    return NextResponse.json({ error: "status deve ser 'confirmado', 'cancelado' ou 'concluido'" }, { status: 400 })
  }

  try {
    if (status === 'cancelado' && agendamento.googleEventId) {
      const profissional = await obterProfissional(session.user.contaId, agendamento.profissionalId)
      if (profissional?.google?.conectado) {
        await deleteCalendarEvent(profissional.google.refreshTokenEnc, profissional.google.calendarId, agendamento.googleEventId)
      }
    }

    await atualizarAgendamento(session.user.contaId, id, { status })
    const updated = await obterAgendamento(session.user.contaId, id)
    return NextResponse.json({ agendamento: updated })
  } catch (error) {
    console.error('Erro ao atualizar status do agendamento:', error)
    return NextResponse.json({ error: 'Erro ao atualizar agendamento' }, { status: 500 })
  }
}
