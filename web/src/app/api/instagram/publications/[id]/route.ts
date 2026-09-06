import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterPublicacaoInstagram, atualizarPublicacaoInstagram, excluirPublicacaoInstagram, registrarAuditoria } from '@/lib/firestore'
import { deleteInstagramPhoto } from '@/lib/storage'
import { finalizarSePronto, criarContainerDeAgendamento } from '@/lib/instagramPublish'
import { agendarPublicacaoExata } from '@/lib/qstash'
import type { PublicacaoInstagram } from '@/types/database'

// GET /api/instagram/publications/[id] - Consulta (e finaliza, se pronto) uma publicação
// ainda "processando" — o compositor faz polling nesse endpoint enquanto vídeo/reels
// terminam de processar na Meta.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const publicacao = await obterPublicacaoInstagram(session.user.contaId, id)
  if (!publicacao) {
    return NextResponse.json({ error: 'Publicação não encontrada' }, { status: 404 })
  }

  const atualizada = await finalizarSePronto(session.user.contaId, publicacao)
  return NextResponse.json({ publicacao: atualizada })
}

// PATCH /api/instagram/publications/[id] - Edita um rascunho/agendamento (legenda,
// colaboradores, texto alternativo, data de agendamento) ou dispara "publicar agora".
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  if (publicacao.status !== 'rascunho' && publicacao.status !== 'agendado') {
    return NextResponse.json({ error: 'Só dá pra editar rascunhos ou agendamentos.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.publicarAgora) {
    const atualizada = await criarContainerDeAgendamento(contaId, publicacao)
    return NextResponse.json({ publicacao: atualizada })
  }

  const patch: Partial<Pick<PublicacaoInstagram, 'caption' | 'altText' | 'collaborators' | 'isAiGenerated' | 'status' | 'agendadoPara'>> = {
    ...(typeof body.caption === 'string' && body.caption.trim() ? { caption: body.caption.trim() } : {}),
    ...(typeof body.altText === 'string' && body.altText.trim() ? { altText: body.altText.trim() } : {}),
    ...(Array.isArray(body.collaborators) ? { collaborators: body.collaborators } : {}),
    ...(typeof body.isAiGenerated === 'boolean' ? { isAiGenerated: body.isAiGenerated } : {}),
    ...(body.agendadoPara === null ? { status: 'rascunho' as const, agendadoPara: null } : {}),
    ...(typeof body.agendadoPara === 'string' ? { status: 'agendado' as const, agendadoPara: new Date(body.agendadoPara) } : {}),
  }

  await atualizarPublicacaoInstagram(contaId, id, patch)
  if (patch.agendadoPara instanceof Date) await agendarPublicacaoExata(contaId, id, patch.agendadoPara)
  await registrarAuditoria(contaId, {
    entidade: 'instagram_publicacao',
    entidadeId: id,
    acao: 'atualizar',
    descricao: body.publicarAgora
      ? 'Disparou "publicar agora" num rascunho/agendamento'
      : patch.agendadoPara instanceof Date
        ? `Reagendou uma publicação para ${patch.agendadoPara.toLocaleString('pt-BR')}`
        : 'Editou um rascunho/agendamento do Instagram',
    usuarioId: session.user.usuarioId ?? 'desconhecido',
    usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
  }).catch(() => {})
  return NextResponse.json({ ok: true })
}

// DELETE /api/instagram/publications/[id] - Remove o registro do histórico no painel
// (e os arquivos temporários de um rascunho/agendamento nunca publicado); não apaga a publicação
// real no Instagram, e preserva o backup automático (mediaItems/backupItems) de tudo que já foi
// publicado — o histórico "some" da tela, mas o backup na nuvem própria continua existindo.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const publicacao = await obterPublicacaoInstagram(session.user.contaId, id)
  if (!publicacao) {
    return NextResponse.json({ error: 'Publicação não encontrada' }, { status: 404 })
  }

  if (publicacao.status !== 'publicado') {
    await Promise.all([
      ...(publicacao.mediaItems ?? []).map((m) => deleteInstagramPhoto(m.path)),
      ...(publicacao.coverItem ? [deleteInstagramPhoto(publicacao.coverItem.path)] : []),
      ...(publicacao.backupItems ?? []).map((b) => deleteInstagramPhoto(b.path)),
    ])
  }
  await excluirPublicacaoInstagram(session.user.contaId, id)
  await registrarAuditoria(session.user.contaId, {
    entidade: 'instagram_publicacao',
    entidadeId: id,
    acao: 'excluir',
    descricao: `Removeu do histórico uma publicação (status: ${publicacao.status})`,
    usuarioId: session.user.usuarioId ?? 'desconhecido',
    usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
  }).catch(() => {})
  return NextResponse.json({ ok: true })
}
