import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterPublicacaoInstagram, atualizarPublicacaoInstagram, excluirPublicacaoInstagram, registrarAuditoria, registrarVersaoPublicacaoInstagram } from '@/lib/firestore'
import { finalizarSePronto, criarContainerDeAgendamento, limparArquivos } from '@/lib/instagramPublish'
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
  if (publicacao.status !== 'rascunho' && publicacao.status !== 'agendado' && publicacao.status !== 'aguardando_confirmacao') {
    return NextResponse.json({ error: 'Só dá pra editar rascunhos ou agendamentos.' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  // Um rascunho nunca passou pelo checkbox de direitos autorais (só é exigido ao agendar/publicar
  // de verdade) — então tanto "publicar agora" quanto transformar o rascunho em agendado por aqui
  // precisam confirmar isso agora, se ainda não tiver sido confirmado antes.
  const vaiAoAr = !!body.publicarAgora || typeof body.agendadoPara === 'string'
  if (vaiAoAr && !publicacao.direitosAutoraisConfirmado && body.direitosAutoraisConfirmado !== true) {
    return NextResponse.json({ error: 'Confirme que você tem os direitos de uso dessa mídia antes de publicar ou agendar.' }, { status: 400 })
  }

  if (body.publicarAgora) {
    if (!publicacao.direitosAutoraisConfirmado) {
      await atualizarPublicacaoInstagram(contaId, id, { direitosAutoraisConfirmado: true }).catch(() => {})
    }
    const atualizada = await criarContainerDeAgendamento(contaId, { ...publicacao, direitosAutoraisConfirmado: true })
    return NextResponse.json({ publicacao: atualizada })
  }

  const patch: Partial<Pick<PublicacaoInstagram, 'caption' | 'altText' | 'collaborators' | 'isAiGenerated' | 'status' | 'agendadoPara' | 'direitosAutoraisConfirmado'>> = {
    ...(typeof body.caption === 'string' && body.caption.trim() ? { caption: body.caption.trim() } : {}),
    ...(typeof body.altText === 'string' && body.altText.trim() ? { altText: body.altText.trim() } : {}),
    ...(Array.isArray(body.collaborators) ? { collaborators: body.collaborators } : {}),
    ...(typeof body.isAiGenerated === 'boolean' ? { isAiGenerated: body.isAiGenerated } : {}),
    ...(body.agendadoPara === null ? { status: 'rascunho' as const, agendadoPara: null } : {}),
    ...(typeof body.agendadoPara === 'string' ? { status: 'agendado' as const, agendadoPara: new Date(body.agendadoPara), direitosAutoraisConfirmado: true } : {}),
  }

  // Snapshot do que estava ANTES dessa edição — só quando algo de texto realmente muda, pra não
  // acumular versão idêntica só porque a pessoa reagendou a data sem tocar na legenda.
  if (patch.caption !== undefined || patch.altText !== undefined || patch.collaborators !== undefined) {
    await registrarVersaoPublicacaoInstagram(contaId, id, {
      ...(publicacao.caption !== undefined ? { caption: publicacao.caption } : {}),
      ...(publicacao.altText !== undefined ? { altText: publicacao.altText } : {}),
      ...(publicacao.collaborators !== undefined ? { collaborators: publicacao.collaborators } : {}),
    }).catch(() => {})
  }

  await atualizarPublicacaoInstagram(contaId, id, patch)
  if (patch.agendadoPara instanceof Date) await agendarPublicacaoExata(contaId, id, patch.agendadoPara)
  // "publicarAgora" já retornou mais acima — a publicação em si é auditada por
  // lib/instagramPublish.ts::logarPublicacaoAuditoria quando o container terminar de verdade.
  await registrarAuditoria(contaId, {
    entidade: 'instagram_publicacao',
    entidadeId: id,
    acao: 'atualizar',
    descricao: patch.agendadoPara instanceof Date
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
    await limparArquivos(publicacao)
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
