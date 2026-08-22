import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarFluxos, criarFluxo, registrarAuditoria } from '@/lib/firestore'
import type { FluxoNode, FluxoEdge } from '@/types/database'

const TIPOS_VALIDOS = new Set(['inicio', 'mensagem', 'menu', 'horario', 'coleta', 'encaminhar_ia', 'encaminhar_humano', 'fim'])

export function validarFluxo(body: unknown): { nome: string; ativo: boolean; nodes: FluxoNode[]; edges: FluxoEdge[] } | null {
  if (!body || typeof body !== 'object') return null
  const { nome, ativo, nodes, edges } = body as Record<string, unknown>
  if (typeof nome !== 'string' || !nome.trim()) return null
  if (typeof ativo !== 'boolean') return null
  if (!Array.isArray(nodes) || !Array.isArray(edges)) return null
  for (const n of nodes) {
    if (!n || typeof n !== 'object' || typeof n.id !== 'string' || !TIPOS_VALIDOS.has(n.tipo)) return null
  }
  for (const e of edges) {
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || typeof e.origem !== 'string' || typeof e.destino !== 'string') return null
  }
  if (!nodes.some((n: FluxoNode) => n.tipo === 'inicio')) return null
  return { nome: nome.trim(), ativo, nodes: nodes as FluxoNode[], edges: edges as FluxoEdge[] }
}

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
