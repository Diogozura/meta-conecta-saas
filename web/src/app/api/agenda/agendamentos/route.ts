import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarAgendamento, criarAgendamento, listarAgendamentos, obterProfissional, obterServico } from '@/lib/firestore'
import { createCalendarEvent, getFreeBusy } from '@/lib/googleCalendar'
import { addAgendamentoEvent } from '@/lib/agendamentoStore'

// GET /api/agenda/agendamentos?profissionalId=&de=&ate=&status=
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const profissionalId = searchParams.get('profissionalId') ?? undefined
    const de = searchParams.get('de') ? new Date(searchParams.get('de')!) : undefined
    const ate = searchParams.get('ate') ? new Date(searchParams.get('ate')!) : undefined
    const status = (searchParams.get('status') as 'confirmado' | 'cancelado' | 'concluido' | null) ?? undefined

    const agendamentos = await listarAgendamentos(session.user.contaId, { profissionalId, de, ate, status: status ?? undefined })
    return NextResponse.json({ agendamentos })
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error)
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}

// POST /api/agenda/agendamentos - Cria um agendamento e, se o profissional
// tiver Google Calendar conectado, cria o evento correspondente.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { profissionalId, servicoId, clienteNome, clienteTelefone, inicio, observacoes, origem } = body

    if (!profissionalId || !servicoId || !clienteNome || !clienteTelefone || !inicio) {
      return NextResponse.json({ error: 'profissionalId, servicoId, clienteNome, clienteTelefone e inicio são obrigatórios' }, { status: 400 })
    }

    const inicioDate = new Date(inicio)
    if (isNaN(inicioDate.getTime())) {
      return NextResponse.json({ error: 'Data/hora de início inválida' }, { status: 400 })
    }

    const [profissional, servico] = await Promise.all([
      obterProfissional(session.user.contaId, profissionalId),
      obterServico(session.user.contaId, servicoId),
    ])
    if (!profissional) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
    }
    if (!servico) {
      return NextResponse.json({ error: 'Serviço não encontrado' }, { status: 404 })
    }

    const fimDate = new Date(inicioDate.getTime() + servico.duracaoMinutos * 60 * 1000)

    // Revalida que o slot ainda está livre (evita corrida entre dois clientes escolhendo o mesmo horário).
    const conflitantes = await listarAgendamentos(session.user.contaId, { profissionalId, status: 'confirmado' })
    const temConflito = conflitantes.some((a) => a.inicio < fimDate && a.fim > inicioDate)
    if (temConflito) {
      return NextResponse.json({ error: 'Esse horário acabou de ser reservado. Escolha outro.' }, { status: 409 })
    }

    if (profissional.google?.conectado) {
      try {
        const busyGoogle = await getFreeBusy(profissional.google.refreshTokenEnc, profissional.google.calendarId, inicioDate, fimDate)
        const bateComGoogle = busyGoogle.some((b) => b.start < fimDate && b.end > inicioDate)
        if (bateComGoogle) {
          return NextResponse.json({ error: 'Esse horário está ocupado na agenda do profissional. Escolha outro.' }, { status: 409 })
        }
      } catch (error) {
        console.error('Erro ao revalidar freebusy do Google antes de agendar, seguindo mesmo assim:', error)
      }
    }

    const agendamento = await criarAgendamento(session.user.contaId, {
      contaId: session.user.contaId,
      profissionalId,
      servicoId,
      clienteNome,
      clienteTelefone,
      inicio: inicioDate,
      fim: fimDate,
      status: 'confirmado',
      origem: origem === 'agente_ia' ? 'agente_ia' : 'manual',
      observacoes,
    })

    if (profissional.google?.conectado) {
      try {
        const googleEventId = await createCalendarEvent(profissional.google.refreshTokenEnc, profissional.google.calendarId, {
          summary: `${servico.nome} — ${clienteNome}`,
          description: `Cliente: ${clienteNome}\nWhatsApp: ${clienteTelefone}${observacoes ? `\nObs: ${observacoes}` : ''}`,
          start: inicioDate,
          end: fimDate,
        })
        await atualizarAgendamento(session.user.contaId, agendamento.id, { googleEventId })
        agendamento.googleEventId = googleEventId
      } catch (error) {
        // Agendamento já está confirmado no sistema — a falta de sync com o
        // Google não deve impedir a confirmação pro cliente.
        console.error('Erro ao criar evento no Google Calendar (agendamento já foi salvo):', error)
      }
    }

    // Notifica quem estiver com o painel aberto (qualquer tela), do mesmo
    // jeito que novas mensagens do WhatsApp já são notificadas em tempo real.
    addAgendamentoEvent({
      id: agendamento.id,
      contaId: session.user.contaId,
      clienteNome,
      profissionalNome: profissional.nome,
      inicio: inicioDate.getTime(),
    })

    return NextResponse.json({ agendamento }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar agendamento:', error)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
