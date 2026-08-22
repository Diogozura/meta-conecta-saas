import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterUsuario } from '@/lib/firestore'

// GET /api/auth/2fa - Estado atual do 2FA do usuário logado (nunca devolve o segredo).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId || !session.user.usuarioId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const usuario = await obterUsuario(session.user.contaId, session.user.usuarioId)
  return NextResponse.json({ ativo: !!usuario?.totpAtivo })
}
