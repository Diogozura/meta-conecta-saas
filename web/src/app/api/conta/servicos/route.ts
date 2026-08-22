import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterConta } from '@/lib/firestore'
import { SERVICOS_PADRAO } from '@/lib/servicos'

// GET /api/conta/servicos - Serviços contratados da PRÓPRIA conta logada (não admin) — usado por telas cliente (ex: abas de Configurações) pra saber o que mostrar.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const conta = await obterConta(session.user.contaId)
  return NextResponse.json({ servicos: conta?.servicosContratados ?? SERVICOS_PADRAO })
}
