import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarEventosAtendimento } from '@/lib/firestore'
import { eventosParaCsv } from '@/lib/csvExport'

// GET /api/conversas/exportar?dias=30 - CSV do histórico de atendimentos (uma linha por evento).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const dias = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('dias') ?? '30', 10) || 30, 1), 90)
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)

  try {
    const eventos = await listarEventosAtendimento(session.user.contaId, desde)
    const csv = eventosParaCsv(eventos)
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="atendimentos-${dias}dias.csv"`,
      },
    })
  } catch (error) {
    console.error('Erro ao exportar atendimentos:', error)
    return NextResponse.json({ error: 'Erro ao exportar atendimentos' }, { status: 500 })
  }
}
