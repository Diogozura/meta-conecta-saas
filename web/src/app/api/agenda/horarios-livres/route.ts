import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarAgendamentos, listarDisponibilidades, obterProfissional, obterServico } from '@/lib/firestore'
import { calcularHorariosLivres } from '@/lib/agendaHelpers'
import { getFreeBusy } from '@/lib/googleCalendar'

// GET /api/agenda/horarios-livres?profissionalId=xxx&servicoId=yyy&de=ISO&ate=ISO
//
// Endpoint-chave da agenda: calcula os slots livres de um profissional para
// um serviço específico, combinando os blocos de Disponibilidade cadastrados,
// os Agendamentos já confirmados, e (se o profissional tiver Google Calendar
// conectado) o freebusy do Google — pra não oferecer horário em cima de um
// compromisso pessoal marcado direto no celular. É este endpoint que o
// agente de IA vai chamar para saber o que oferecer ao cliente no WhatsApp.
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const profissionalId = searchParams.get('profissionalId')
    const servicoId = searchParams.get('servicoId')
    const deParam = searchParams.get('de')
    const ateParam = searchParams.get('ate')

    if (!profissionalId || !servicoId || !deParam || !ateParam) {
      return NextResponse.json({ error: 'profissionalId, servicoId, de e ate são obrigatórios' }, { status: 400 })
    }

    const de = new Date(deParam)
    const ate = new Date(ateParam)
    if (isNaN(de.getTime()) || isNaN(ate.getTime()) || ate <= de) {
      return NextResponse.json({ error: 'Intervalo de data inválido' }, { status: 400 })
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

    const [disponibilidades, agendamentos] = await Promise.all([
      listarDisponibilidades(session.user.contaId, profissionalId, de, ate),
      listarAgendamentos(session.user.contaId, { profissionalId, de, ate, status: 'confirmado' }),
    ])

    const ocupados = agendamentos.map((a) => ({ inicio: a.inicio, fim: a.fim }))

    if (profissional.google?.conectado) {
      try {
        const busyGoogle = await getFreeBusy(profissional.google.refreshTokenEnc, profissional.google.calendarId, de, ate)
        ocupados.push(...busyGoogle.map((b) => ({ inicio: b.start, fim: b.end })))
      } catch (error) {
        // Não derruba o endpoint por causa do Google — melhor oferecer
        // horários "otimistas" (só com base no que o próprio sistema sabe)
        // do que travar o agendamento se o token do Google expirou/foi revogado.
        console.error('Erro ao consultar freebusy do Google, seguindo sem esses dados:', error)
      }
    }

    const slots = calcularHorariosLivres({
      disponibilidades: disponibilidades.map((d) => ({ inicio: d.inicio, fim: d.fim })),
      ocupados,
      duracaoMinutos: servico.duracaoMinutos,
    })

    return NextResponse.json({
      horarios: slots.map((s) => ({ inicio: s.inicio.toISOString(), fim: s.fim.toISOString() })),
    })
  } catch (error) {
    console.error('Erro ao calcular horários livres:', error)
    return NextResponse.json({ error: 'Erro ao calcular horários livres' }, { status: 500 })
  }
}
