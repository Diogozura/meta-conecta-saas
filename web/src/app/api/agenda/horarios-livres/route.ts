import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { buscarHorariosLivres, AgendaServiceError } from '@/lib/agendaService'

// GET /api/agenda/horarios-livres?profissionalId=xxx&servicoId=yyy&de=ISO&ate=ISO
//
// Endpoint-chave da agenda: calcula os slots livres de um profissional para
// um serviço específico, combinando os blocos de Disponibilidade cadastrados,
// os Agendamentos já confirmados, e (se o profissional tiver Google Calendar
// conectado) o freebusy do Google — pra não oferecer horário em cima de um
// compromisso pessoal marcado direto no celular. A mesma lógica (lib/agendaService.ts)
// é usada pelo agente de IA para saber o que oferecer ao cliente no WhatsApp.
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

    const slots = await buscarHorariosLivres(session.user.contaId, profissionalId, servicoId, de, ate)

    return NextResponse.json({
      horarios: slots.map((s) => ({ inicio: s.inicio.toISOString(), fim: s.fim.toISOString() })),
    })
  } catch (error) {
    if (error instanceof AgendaServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Erro ao calcular horários livres:', error)
    return NextResponse.json({ error: 'Erro ao calcular horários livres' }, { status: 500 })
  }
}
