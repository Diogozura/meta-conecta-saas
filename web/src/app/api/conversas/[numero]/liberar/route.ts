import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { liberarAtendenteConversa } from '@/lib/firestore'

// POST /api/conversas/[numero]/liberar - Solta a reivindicação sem reativar a IA (volta pra fila "aguardando humano").
export async function POST(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params
  try {
    await liberarAtendenteConversa(session.user.contaId, numero)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao liberar conversa:', error)
    return NextResponse.json({ error: 'Erro ao liberar conversa' }, { status: 500 })
  }
}
