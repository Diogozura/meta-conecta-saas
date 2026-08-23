import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarFluxos, criarFluxo, registrarAuditoria } from '@/lib/firestore'
import { validarFluxo } from '@/lib/validarFluxo'

// GET /api/fluxo - Lista os fluxos de atendimento da conta
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const fluxos = await listarFluxos(session.user.contaId)
    return NextResponse.json({ fluxos })
  } catch (error) {
    console.error('Erro ao listar fluxos:', error)
    return NextResponse.json({ error: 'Erro ao listar fluxos' }, { status: 500 })
  }
}

// POST /api/fluxo - Cria um novo fluxo de atendimento
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const dados = validarFluxo(body)
  if (!dados) {
    return NextResponse.json({ error: 'Fluxo inválido — precisa de nome, um nó "inicio" e nodes/edges bem formados' }, { status: 400 })
  }

  try {
    const fluxo = await criarFluxo(session.user.contaId, dados)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'fluxo',
      entidadeId: fluxo.id,
      acao: 'criar',
      descricao: `Criou o fluxo "${fluxo.nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ fluxo }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar fluxo:', error)
    return NextResponse.json({ error: 'Erro ao criar fluxo' }, { status: 500 })
  }
}
