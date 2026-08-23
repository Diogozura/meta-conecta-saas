import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarTickets, criarTicket } from '@/lib/firestore'
import { validarNovoTicket } from '@/lib/validarTicket'
import { gerarProtocolo } from '@/lib/variaveisFluxo'

// GET /api/tickets - Lista os tickets de suporte da conta
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const tickets = await listarTickets(session.user.contaId)
    return NextResponse.json({ tickets })
  } catch (error) {
    console.error('Erro ao listar tickets:', error)
    return NextResponse.json({ error: 'Erro ao listar tickets' }, { status: 500 })
  }
}

// POST /api/tickets - Abre um ticket manualmente (o fluxo de atendimento também pode abrir um via nó "criar_ticket")
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const dados = validarNovoTicket(body)
  if (!dados) {
    return NextResponse.json({ error: 'Ticket inválido — numero e assunto são obrigatórios' }, { status: 400 })
  }

  try {
    const ticket = await criarTicket(session.user.contaId, {
      ...dados,
      protocolo: gerarProtocolo(),
      criadoPor: session.user.usuarioId ?? 'desconhecido',
    })
    return NextResponse.json({ ticket }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar ticket:', error)
    return NextResponse.json({ error: 'Erro ao criar ticket' }, { status: 500 })
  }
}
