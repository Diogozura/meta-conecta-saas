import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarConjuntoHashtags, listarConjuntosHashtags, registrarAuditoria } from '@/lib/firestore'

// GET /api/hashtag-sets
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const conjuntos = await listarConjuntosHashtags(session.user.contaId)
    return NextResponse.json({ conjuntos })
  } catch (error) {
    console.error('Erro ao listar conjuntos de hashtags:', error)
    return NextResponse.json({ error: 'Erro ao listar conjuntos de hashtags' }, { status: 500 })
  }
}

// POST /api/hashtag-sets
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const hashtags = typeof body?.hashtags === 'string' ? body.hashtags.trim() : ''
  if (!nome || !hashtags) {
    return NextResponse.json({ error: 'nome e hashtags são obrigatórios' }, { status: 400 })
  }

  try {
    const conjunto = await criarConjuntoHashtags(session.user.contaId, { nome, hashtags })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'conjunto_hashtags',
      entidadeId: conjunto.id,
      acao: 'criar',
      descricao: `Criou o conjunto de hashtags "${nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ conjunto }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar conjunto de hashtags:', error)
    return NextResponse.json({ error: 'Erro ao criar conjunto de hashtags' }, { status: 500 })
  }
}
