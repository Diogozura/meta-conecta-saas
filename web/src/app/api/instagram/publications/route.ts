import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarPublicacoesInstagram } from '@/lib/firestore'

// GET /api/instagram/publications - Histórico de publicações feitas pelo painel
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const publicacoes = await listarPublicacoesInstagram(session.user.contaId)
  return NextResponse.json({ publicacoes })
}
