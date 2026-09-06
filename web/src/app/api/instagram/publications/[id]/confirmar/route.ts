import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterPublicacaoInstagram, registrarAuditoria } from '@/lib/firestore'
import { criarContainerDeAgendamento } from '@/lib/instagramPublish'

// POST /api/instagram/publications/[id]/confirmar - Confirmação manual (InstagramPublishConfig.
// confirmacaoManualAtiva): a publicação estava esperando em 'aguardando_confirmacao', essa rota
// dispara a publicação de verdade (mesmo caminho de "publicar agora").
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const publicacao = await obterPublicacaoInstagram(contaId, id)
  if (!publicacao) {
    return NextResponse.json({ error: 'Publicação não encontrada' }, { status: 404 })
  }
  if (publicacao.status !== 'aguardando_confirmacao') {
    return NextResponse.json({ error: 'Essa publicação não está esperando confirmação.' }, { status: 400 })
  }

  const atualizada = await criarContainerDeAgendamento(contaId, publicacao)
  await registrarAuditoria(contaId, {
    entidade: 'instagram_publicacao',
    entidadeId: id,
    acao: 'atualizar',
    descricao: 'Confirmou manualmente uma publicação que estava esperando aprovação',
    usuarioId: session.user.usuarioId ?? 'desconhecido',
    usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
  }).catch(() => {})

  return NextResponse.json({ publicacao: atualizada })
}
