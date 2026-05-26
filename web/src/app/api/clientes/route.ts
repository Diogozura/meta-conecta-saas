import { NextRequest, NextResponse } from 'next/server'
import { criarCliente, listarClientes } from '@/lib/firestore'
import { auth } from '@/lib/auth'

// GET /api/clientes - Listar clientes
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const clientes = await listarClientes(session.user.contaId)
    return NextResponse.json({ clientes })
  } catch (error) {
    console.error('Erro ao listar clientes:', error)
    return NextResponse.json({ error: 'Erro ao listar clientes' }, { status: 500 })
  }
}

// POST /api/clientes - Criar cliente
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await req.json()
    const { nome, email, telefone, whatsapp, tag, notas } = body

    if (!nome) {
      return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
    }

    const cliente = await criarCliente(session.user.contaId, {
      contaId: session.user.contaId,
      nome,
      email,
      telefone,
      whatsapp,
      tag,
      notas,
      status: 'ativo',
    })

    return NextResponse.json({ cliente }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar cliente:', error)
    return NextResponse.json({ error: 'Erro ao criar cliente' }, { status: 500 })
  }
}
