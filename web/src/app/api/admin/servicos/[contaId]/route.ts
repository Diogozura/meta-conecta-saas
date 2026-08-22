import { NextRequest, NextResponse } from 'next/server'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import { atualizarConta } from '@/lib/firestore'

// PATCH /api/admin/servicos/[contaId] - Define quais módulos essa conta pode ver/usar (admin de plataforma).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ contaId: string }> }) {
  const { session, isPlatformAdmin } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { contaId } = await params
  const body = await req.json().catch(() => null)
  const whatsapp = !!body?.whatsapp
  const agenda = !!body?.agenda
  const instagram = !!body?.instagram

  try {
    await atualizarConta(contaId, { servicosContratados: { whatsapp, agenda, instagram } })
    console.log('[admin/servicos] Serviços alterados', { contaId, whatsapp, agenda, instagram, por: session?.email })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao atualizar serviços contratados da conta:', error)
    return NextResponse.json({ error: 'Erro ao atualizar serviços' }, { status: 500 })
  }
}
