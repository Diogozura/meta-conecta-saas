import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { pausarPublicacoesInstagramNoPeriodo, registrarAuditoria } from '@/lib/firestore'

// POST /api/instagram/publications/pausar - Pausa (ou retoma) todos os agendamentos de um período
// (férias, crise) — o cron pula qualquer coisa pausada, mesmo já vencida.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const inicio = typeof body.inicio === 'string' ? new Date(body.inicio) : null
  const fim = typeof body.fim === 'string' ? new Date(body.fim) : null
  const pausado = body.pausado !== false

  if (!inicio || !fim || Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || inicio > fim) {
    return NextResponse.json({ error: 'Período inválido' }, { status: 400 })
  }

  try {
    const afetadas = await pausarPublicacoesInstagramNoPeriodo(session.user.contaId, inicio, fim, pausado)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_publicacao',
      acao: 'atualizar',
      descricao: `${pausado ? 'Pausou' : 'Retomou'} ${afetadas} agendamento(s) entre ${inicio.toLocaleDateString('pt-BR')} e ${fim.toLocaleDateString('pt-BR')}`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ ok: true, afetadas })
  } catch (error) {
    console.error('Erro ao pausar/retomar publicações:', error)
    return NextResponse.json({ error: 'Erro ao pausar/retomar publicações' }, { status: 500 })
  }
}
