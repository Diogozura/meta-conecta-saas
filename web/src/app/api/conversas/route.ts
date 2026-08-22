import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarConversas } from '@/lib/firestore'

// GET /api/conversas - Resumo de status/fila de todas as conversas da conta
// (sobreposto na lista do painel, que é montada a partir das mensagens).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const conversas = await listarConversas(session.user.contaId)
    return NextResponse.json({ conversas })
  } catch (error) {
    console.error('Erro ao listar conversas:', error)
    return NextResponse.json({ error: 'Erro ao listar conversas' }, { status: 500 })
  }
}
