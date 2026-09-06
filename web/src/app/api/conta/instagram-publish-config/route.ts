import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterConta, atualizarInstagramPublishConfig, registrarAuditoria } from '@/lib/firestore'
import type { InstagramPublishConfig } from '@/types/database'

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
  const patch: Partial<InstagramPublishConfig> = {}
  if (typeof body.assinatura === 'string') patch.assinatura = body.assinatura
  if (typeof body.assinaturaAtiva === 'boolean') patch.assinaturaAtiva = body.assinaturaAtiva
  if (typeof body.marcaDaguaAtiva === 'boolean') patch.marcaDaguaAtiva = body.marcaDaguaAtiva
  if (body.guiaDeMarca && typeof body.guiaDeMarca === 'object') {
    patch.guiaDeMarca = {
      ...(Array.isArray(body.guiaDeMarca.cores) ? { cores: body.guiaDeMarca.cores.filter((c: unknown) => typeof c === 'string') } : {}),
      ...(Array.isArray(body.guiaDeMarca.fontes) ? { fontes: body.guiaDeMarca.fontes.filter((f: unknown) => typeof f === 'string') } : {}),
      ...(typeof body.guiaDeMarca.tomDeVoz === 'string' ? { tomDeVoz: body.guiaDeMarca.tomDeVoz } : {}),
    }
  }
  if (Array.isArray(body.termosProibidos)) {
    patch.termosProibidos = body.termosProibidos.filter((t: unknown) => typeof t === 'string' && t.trim())
  }
  if (typeof body.fusoHorario === 'string') patch.fusoHorario = body.fusoHorario.trim()
  if (typeof body.numeroAvisoWhatsapp === 'string') patch.numeroAvisoWhatsapp = body.numeroAvisoWhatsapp.trim()
  if (typeof body.confirmacaoManualAtiva === 'boolean') patch.confirmacaoManualAtiva = body.confirmacaoManualAtiva

  try {
    await atualizarInstagramPublishConfig(session.user.contaId, patch)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_config',
      acao: 'atualizar',
      descricao: 'Atualizou a configuração de publicação do Instagram (marca d’água, assinatura, guia de marca ou termos proibidos)',
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao salvar configuração de publicação do Instagram:', error)
    return NextResponse.json({ error: 'Erro ao salvar configuração' }, { status: 500 })
  }
}
