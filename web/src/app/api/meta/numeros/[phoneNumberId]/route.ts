import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterMetaAccess, removerNumeroWhatsapp } from '@/lib/firestore'

// DELETE /api/meta/numeros/[phoneNumberId] - Remove um número adicional (o principal não pode ser removido por aqui).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ phoneNumberId: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { phoneNumberId } = await params
  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    return NextResponse.json({ error: 'WhatsApp ainda não conectado' }, { status: 404 })
  }

  try {
    await removerNumeroWhatsapp(session.user.contaId, metaAccess.id, phoneNumberId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao remover número adicional:', error)
    return NextResponse.json({ error: 'Erro ao remover número' }, { status: 500 })
  }
}
