import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterConversa, definirIaAtivaConversa } from '@/lib/firestore'

// GET /api/conversas/[numero]/ia - Estado da conversa (IA, status, atendente)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params
  const conversa = await obterConversa(session.user.contaId, numero)
  return NextResponse.json({
    iaAtiva: conversa?.iaAtiva ?? true,
    motivoTransferencia: conversa?.motivoTransferencia ?? null,
    status: conversa?.status ?? 'em_andamento',
    atendenteId: conversa?.atendenteId ?? null,
    atendenteNome: conversa?.atendenteNome ?? null,
    assumidoEm: conversa?.assumidoEm ?? null,
    setor: conversa?.setor ?? null,
  })
}

// PATCH /api/conversas/[numero]/ia - Liga/desliga a IA pra essa conversa (ex: reativar depois de um atendente assumir)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params
  const body = await req.json()
  if (typeof body.iaAtiva !== 'boolean') {
    return NextResponse.json({ error: 'iaAtiva é obrigatório' }, { status: 400 })
  }

  await definirIaAtivaConversa(session.user.contaId, numero, body.iaAtiva)
  return NextResponse.json({ ok: true })
}
