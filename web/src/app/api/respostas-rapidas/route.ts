import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarRespostaRapida, listarRespostasRapidas, registrarAuditoria } from '@/lib/firestore'

// GET /api/respostas-rapidas
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const respostas = await listarRespostasRapidas(session.user.contaId)
    return NextResponse.json({ respostas })
  } catch (error) {
    console.error('Erro ao listar respostas rápidas:', error)
    return NextResponse.json({ error: 'Erro ao listar respostas rápidas' }, { status: 500 })
  }
}

// POST /api/respostas-rapidas
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const atalho = typeof body?.atalho === 'string' ? body.atalho.trim() : ''
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : ''
  if (!atalho || !texto) {
    return NextResponse.json({ error: 'atalho e texto são obrigatórios' }, { status: 400 })
  }

  try {
    const resposta = await criarRespostaRapida(session.user.contaId, { atalho, texto })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'resposta_rapida',
      entidadeId: resposta.id,
      acao: 'criar',
      descricao: `Criou a resposta rápida "/${atalho}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ resposta }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar resposta rápida:', error)
    return NextResponse.json({ error: 'Erro ao criar resposta rápida' }, { status: 500 })
  }
}
