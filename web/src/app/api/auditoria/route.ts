import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarAuditoria } from '@/lib/firestore'

// GET /api/auditoria - Log de mudanças em configurações sensíveis da conta (fluxo, respostas rápidas, equipe).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const registros = await listarAuditoria(session.user.contaId)
    return NextResponse.json({ registros })
  } catch (error) {
    console.error('Erro ao listar auditoria:', error)
    return NextResponse.json({ error: 'Erro ao listar auditoria' }, { status: 500 })
  }
}
