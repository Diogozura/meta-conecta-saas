import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarAgendamentos } from '@/lib/firestore'
import { criarAgendamentoInterno, AgendaServiceError } from '@/lib/agendaService'

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
    const statusParam = searchParams.get('status')
    const statusValidos = ['confirmado', 'cancelado', 'concluido'] as const
    if (statusParam && !statusValidos.includes(statusParam as (typeof statusValidos)[number])) {
      return NextResponse.json({ error: "status deve ser 'confirmado', 'cancelado' ou 'concluido'" }, { status: 400 })
    }
    const status = (statusParam as 'confirmado' | 'cancelado' | 'concluido' | null) ?? undefined

    const agendamentos = await listarAgendamentos(session.user.contaId, { profissionalId, de, ate, status: status ?? undefined })
    return NextResponse.json({ agendamentos })
  } catch (error) {
    console.error('Erro ao listar agendamentos:', error)
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}

// POST /api/agenda/agendamentos - Cria um agendamento (mesma regra usada
// pelo agente de IA, em lib/agendaService.ts).
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

    const agendamento = await criarAgendamentoInterno(session.user.contaId, {
      profissionalId,
      servicoId,
      clienteNome,
      clienteTelefone,
      inicio: inicioDate,
      origem: origem === 'agente_ia' ? 'agente_ia' : 'manual',
      observacoes,
    })

    return NextResponse.json({ agendamento }, { status: 201 })
  } catch (error) {
    if (error instanceof AgendaServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error('Erro ao criar agendamento:', error)
    return NextResponse.json({ error: 'Erro ao criar agendamento' }, { status: 500 })
  }
}
