import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { assumirConversa } from '@/lib/firestore'

// POST /api/conversas/[numero]/assumir - Atendente reivindica a conversa (pausa a IA e registra quem assumiu).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!session.user.usuarioId) {
    return NextResponse.json({ error: 'Usuário sem cadastro de atendente nessa conta' }, { status: 403 })
  }

  const { numero } = await params
  try {
    await assumirConversa(session.user.contaId, numero, session.user.usuarioId, session.user.name)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao assumir conversa:', error)
    return NextResponse.json({ error: 'Erro ao assumir conversa' }, { status: 500 })
  }
}
