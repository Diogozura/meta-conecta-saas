import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarPerguntaFrequenteInstagram, listarPerguntasFrequentesInstagram } from '@/lib/firestore'

// GET /api/instagram/perguntas-frequentes
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const perguntas = await listarPerguntasFrequentesInstagram(session.user.contaId)
    return NextResponse.json({ perguntas })
  } catch (error) {
    console.error('Erro ao listar perguntas frequentes:', error)
    return NextResponse.json({ error: 'Erro ao listar perguntas frequentes' }, { status: 500 })
  }
}

// POST /api/instagram/perguntas-frequentes
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const pergunta = typeof body?.pergunta === 'string' ? body.pergunta.trim() : ''
  const resposta = typeof body?.resposta === 'string' ? body.resposta.trim() : ''
  if (!pergunta || !resposta) {
    return NextResponse.json({ error: 'pergunta e resposta são obrigatórias' }, { status: 400 })
  }

  try {
    const nova = await criarPerguntaFrequenteInstagram(session.user.contaId, { pergunta, resposta })
    return NextResponse.json({ pergunta: nova }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar pergunta frequente:', error)
    return NextResponse.json({ error: 'Erro ao criar pergunta frequente' }, { status: 500 })
  }
}
