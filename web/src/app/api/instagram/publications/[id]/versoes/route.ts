import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarVersoesPublicacaoInstagram } from '@/lib/firestore'

// GET /api/instagram/publications/[id]/versoes - Histórico de versões da legenda/texto
// alternativo/colaboradores de um rascunho/agendamento, pra dar pra desfazer uma edição.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const versoes = await listarVersoesPublicacaoInstagram(session.user.contaId, id)
    return NextResponse.json({ versoes })
  } catch (error) {
    console.error('Erro ao listar versões da publicação:', error)
    return NextResponse.json({ error: 'Erro ao listar versões' }, { status: 500 })
  }
}
