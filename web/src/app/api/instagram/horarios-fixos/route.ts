import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarHorarioFixoInstagram, listarHorariosFixosInstagram } from '@/lib/firestore'

// GET /api/instagram/horarios-fixos - Horários reutilizáveis ("toda terça às 18h")
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const horarios = await listarHorariosFixosInstagram(session.user.contaId)
    return NextResponse.json({ horarios })
  } catch (error) {
    console.error('Erro ao listar horários fixos:', error)
    return NextResponse.json({ error: 'Erro ao listar horários fixos' }, { status: 500 })
  }
}

// POST /api/instagram/horarios-fixos
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const label = typeof body?.label === 'string' ? body.label.trim() : ''
  const diaSemana = Number(body?.diaSemana)
  const horario = typeof body?.horario === 'string' ? body.horario.trim() : ''

  if (!label || !Number.isInteger(diaSemana) || diaSemana < 0 || diaSemana > 6 || !/^\d{2}:\d{2}$/.test(horario)) {
    return NextResponse.json({ error: 'label, diaSemana (0-6) e horario (HH:mm) são obrigatórios' }, { status: 400 })
  }

  try {
    const horarioFixo = await criarHorarioFixoInstagram(session.user.contaId, { label, diaSemana, horario })
    return NextResponse.json({ horario: horarioFixo }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar horário fixo:', error)
    return NextResponse.json({ error: 'Erro ao criar horário fixo' }, { status: 500 })
  }
}
