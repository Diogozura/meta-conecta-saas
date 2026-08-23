import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarTicket } from '@/lib/firestore'

// POST /api/tickets/[id]/liberar - Solta a reivindicação do ticket (mesmo padrão de conversas/[numero]/liberar) — não mexe no status.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  try {
    await atualizarTicket(session.user.contaId, id, { atendenteId: null, atendenteNome: null })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao liberar ticket:', error)
    return NextResponse.json({ error: 'Erro ao liberar ticket' }, { status: 500 })
  }
}
