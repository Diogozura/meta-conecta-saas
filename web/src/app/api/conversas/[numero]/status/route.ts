import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { encerrarConversa, reabrirConversa } from '@/lib/firestore'
import { enviarPedidoCsat } from '@/lib/csatService'

// PATCH /api/conversas/[numero]/status - Encerra ou reabre a conversa manualmente.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ numero: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId
  const encerradaPor = session.user.usuarioId

  const { numero } = await params
  const body = await req.json()
  const { status } = body as { status?: 'encerrada' | 'aberta' }
  if (status !== 'encerrada' && status !== 'aberta') {
    return NextResponse.json({ error: "status deve ser 'encerrada' ou 'aberta'" }, { status: 400 })
  }

  try {
    if (status === 'encerrada') {
      await encerrarConversa(contaId, numero, encerradaPor)
      // Best-effort — se falhar (WhatsApp não conectado, etc.), a conversa já está encerrada de qualquer forma.
      // Aguarda (em vez de "fire and forget") pra não arriscar a função serverless
      // ser encerrada antes do envio terminar.
      await enviarPedidoCsat(contaId, numero).catch(() => {})
    } else {
      await reabrirConversa(contaId, numero)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar status da conversa:', error)
    return NextResponse.json({ error: 'Erro ao atualizar status da conversa' }, { status: 500 })
  }
}
