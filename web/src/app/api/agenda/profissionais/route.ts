import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarProfissional, listarProfissionais } from '@/lib/firestore'
import { sanitizeProfissional } from '@/lib/agendaHelpers'

// GET /api/agenda/profissionais - Listar profissionais da conta
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const profissionais = await listarProfissionais(session.user.contaId)
    return NextResponse.json({ profissionais: profissionais.map(sanitizeProfissional) })
  } catch (error) {
    console.error('Erro ao listar profissionais:', error)
    return NextResponse.json({ error: 'Erro ao listar profissionais' }, { status: 500 })
  }
}

// POST /api/agenda/profissionais - Criar profissional
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { nome, telefone } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const profissional = await criarProfissional(session.user.contaId, {
      contaId: session.user.contaId,
      nome,
      telefone,
      ativo: true,
    })

    return NextResponse.json({ profissional }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar profissional:', error)
    return NextResponse.json({ error: 'Erro ao criar profissional' }, { status: 500 })
  }
}
