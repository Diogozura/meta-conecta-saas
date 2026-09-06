import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterPublicacaoInstagram, atualizarPublicacaoInstagram, excluirPublicacaoInstagram } from '@/lib/firestore'
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
  return NextResponse.json({ ok: true })
}

// DELETE /api/instagram/publications/[id] - Remove o registro do histórico no painel
// (e os arquivos ainda hospedados de um rascunho/agendamento); não apaga a publicação
// real no Instagram quando já publicada.
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

  await Promise.all([
    ...(publicacao.mediaItems ?? []).map((m) => deleteInstagramPhoto(m.path)),
    ...(publicacao.coverItem ? [deleteInstagramPhoto(publicacao.coverItem.path)] : []),
  ])
  await excluirPublicacaoInstagram(session.user.contaId, id)
  return NextResponse.json({ ok: true })
}
