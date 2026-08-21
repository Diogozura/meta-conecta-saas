import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterInstagramAccess, excluirInstagramAccess } from '@/lib/firestore'

export async function POST() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const existing = await obterInstagramAccess(session.user.contaId)
  if (existing) {
    await excluirInstagramAccess(session.user.contaId, existing.id)
  }

  return NextResponse.json({ success: true })
}
