import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { exportarDadosCliente } from '@/lib/firestore'

// GET /api/conversas/[numero]/lgpd/exportar - Baixa em JSON tudo que a conta guarda sobre esse número (cadastro, conversa, mensagens, avaliações de CSAT) — direito de portabilidade da LGPD (art. 18).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { numero } = await params

  try {
    const dados = await exportarDadosCliente(session.user.contaId, numero)
    return new NextResponse(JSON.stringify(dados, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="dados-${numero.replace(/\D/g, '')}.json"`,
      },
    })
  } catch (error) {
    console.error('Erro ao exportar dados do cliente:', error)
    return NextResponse.json({ error: 'Erro ao exportar dados do cliente' }, { status: 500 })
  }
}
