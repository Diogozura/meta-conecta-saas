import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarTicket } from '@/lib/firestore'

// POST /api/tickets/[id]/assumir - Atendente reivindica o ticket (mesmo padrão de conversas/[numero]/assumir).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!session.user.usuarioId) {
    return NextResponse.json({ error: 'Usuário sem cadastro de atendente nessa conta' }, { status: 403 })
  }

  const { id } = await params
  const atendenteNome = session.user.name ?? session.user.email ?? 'Atendente'
  try {
    await atualizarTicket(session.user.contaId, id, {
      atendenteId: session.user.usuarioId,
      atendenteNome,
      status: 'em_andamento',
    })
    return NextResponse.json({ ok: true, atendenteId: session.user.usuarioId, atendenteNome })
  } catch (error) {
    console.error('Erro ao assumir ticket:', error)
    return NextResponse.json({ error: 'Erro ao assumir ticket' }, { status: 500 })
  }
}
