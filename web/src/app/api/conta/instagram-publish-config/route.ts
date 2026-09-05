import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterConta, atualizarInstagramPublishConfig } from '@/lib/firestore'

// GET /api/conta/instagram-publish-config - Assinatura e marca d'água padrão do Instagram
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const conta = await obterConta(session.user.contaId)
  return NextResponse.json({ config: conta?.instagramPublishConfig ?? {} })
}

// PUT /api/conta/instagram-publish-config - Salva assinatura/toggle (o logo tem rota própria, /logo)
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const patch: { assinatura?: string; assinaturaAtiva?: boolean; marcaDaguaAtiva?: boolean } = {}
  if (typeof body.assinatura === 'string') patch.assinatura = body.assinatura
  if (typeof body.assinaturaAtiva === 'boolean') patch.assinaturaAtiva = body.assinaturaAtiva
  if (typeof body.marcaDaguaAtiva === 'boolean') patch.marcaDaguaAtiva = body.marcaDaguaAtiva

  try {
    await atualizarInstagramPublishConfig(session.user.contaId, patch)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao salvar configuração de publicação do Instagram:', error)
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
  }
}
