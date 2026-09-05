import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { criarModeloLegenda, listarModelosLegenda, registrarAuditoria } from '@/lib/firestore'

// GET /api/caption-templates
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const modelos = await listarModelosLegenda(session.user.contaId)
    return NextResponse.json({ modelos })
  } catch (error) {
    console.error('Erro ao listar modelos de legenda:', error)
    return NextResponse.json({ error: 'Erro ao listar modelos de legenda' }, { status: 500 })
  }
}

// POST /api/caption-templates
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const gancho = typeof body?.gancho === 'string' ? body.gancho.trim() : ''
  const corpo = typeof body?.corpo === 'string' ? body.corpo.trim() : ''
  const cta = typeof body?.cta === 'string' ? body.cta.trim() : ''
  if (!nome || (!gancho && !corpo && !cta)) {
    return NextResponse.json({ error: 'Informe um nome e pelo menos um dos campos (gancho, corpo ou CTA)' }, { status: 400 })
  }

  try {
    const modelo = await criarModeloLegenda(session.user.contaId, { nome, gancho, corpo, cta })
    await registrarAuditoria(session.user.contaId, {
      entidade: 'modelo_legenda',
      entidadeId: modelo.id,
      acao: 'criar',
      descricao: `Criou o modelo de legenda "${nome}"`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ modelo }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar modelo de legenda:', error)
    return NextResponse.json({ error: 'Erro ao criar modelo de legenda' }, { status: 500 })
  }
}
