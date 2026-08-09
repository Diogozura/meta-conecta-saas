import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarServico, listarServicos } from '@/lib/firestore'

// GET /api/agenda/servicos - Listar serviços da conta
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const servicos = await listarServicos(session.user.contaId)
    return NextResponse.json({ servicos })
  } catch (error) {
    console.error('Erro ao listar serviços:', error)
    return NextResponse.json({ error: 'Erro ao listar serviços' }, { status: 500 })
  }
}

// POST /api/agenda/servicos - Criar serviço
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { nome, duracaoMinutos, profissionalIds } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }
    if (!duracaoMinutos || duracaoMinutos <= 0) {
      return NextResponse.json({ error: 'Duração (em minutos) é obrigatória e deve ser maior que zero' }, { status: 400 })
    }

    const servico = await criarServico(session.user.contaId, {
      contaId: session.user.contaId,
      nome,
      duracaoMinutos,
      profissionalIds,
      ativo: true,
    })

    return NextResponse.json({ servico }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar serviço:', error)
    return NextResponse.json({ error: 'Erro ao criar serviço' }, { status: 500 })
  }
}
