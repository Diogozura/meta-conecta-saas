import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { excluirPerguntaFrequenteInstagram } from '@/lib/firestore'

// DELETE /api/instagram/perguntas-frequentes/[id]
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    await excluirPerguntaFrequenteInstagram(session.user.contaId, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao excluir pergunta frequente:', error)
    return NextResponse.json({ error: 'Erro ao excluir pergunta frequente' }, { status: 500 })
  }
}
