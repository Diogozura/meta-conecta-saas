import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarDisponibilidade, listarDisponibilidades, obterProfissional } from '@/lib/firestore'

const MAX_REPETICOES = 52 // limite de segurança pro atalho "repetir por N semanas"

// GET /api/agenda/disponibilidades?profissionalId=xxx&de=ISO&ate=ISO
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const profissionalId = searchParams.get('profissionalId')
    if (!profissionalId) {
      return NextResponse.json({ error: 'profissionalId é obrigatório' }, { status: 400 })
    }

    const de = searchParams.get('de') ? new Date(searchParams.get('de')!) : undefined
    const ate = searchParams.get('ate') ? new Date(searchParams.get('ate')!) : undefined

    const disponibilidades = await listarDisponibilidades(session.user.contaId, profissionalId, de, ate)
    return NextResponse.json({ disponibilidades })
  } catch (error) {
    console.error('Erro ao listar disponibilidades:', error)
    return NextResponse.json({ error: 'Erro ao listar disponibilidades' }, { status: 500 })
  }
}

// POST /api/agenda/disponibilidades - Cria um bloco de disponibilidade.
// Aceita `repetirSemanas` (0-52): cria cópias do mesmo bloco nas N semanas seguintes.
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { profissionalId, inicio, fim, repetirSemanas } = body

    if (!profissionalId || !inicio || !fim) {
      return NextResponse.json({ error: 'profissionalId, inicio e fim são obrigatórios' }, { status: 400 })
    }

    const inicioDate = new Date(inicio)
    const fimDate = new Date(fim)
    if (isNaN(inicioDate.getTime()) || isNaN(fimDate.getTime()) || fimDate <= inicioDate) {
      return NextResponse.json({ error: 'Intervalo de data/hora inválido' }, { status: 400 })
    }

    const profissional = await obterProfissional(session.user.contaId, profissionalId)
    if (!profissional) {
      return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
    }

    const repeticoes = Math.min(Math.max(Number(repetirSemanas) || 0, 0), MAX_REPETICOES)

    const criados = []
    for (let semana = 0; semana <= repeticoes; semana++) {
      const offsetMs = semana * 7 * 24 * 60 * 60 * 1000
      const disponibilidade = await criarDisponibilidade(session.user.contaId, {
        contaId: session.user.contaId,
        profissionalId,
        inicio: new Date(inicioDate.getTime() + offsetMs),
        fim: new Date(fimDate.getTime() + offsetMs),
      })
      criados.push(disponibilidade)
    }

    return NextResponse.json({ disponibilidades: criados }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar disponibilidade:', error)
    return NextResponse.json({ error: 'Erro ao criar disponibilidade' }, { status: 500 })
  }
}
