import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { auth } from '@/lib/auth'
import { atualizarUsuario } from '@/lib/firestore'
import { gerarSegredoTotp, totpUri } from '@/lib/totp'

/**
 * POST /api/auth/2fa/setup - Gera um novo segredo TOTP e já grava
 * criptografado (com totpAtivo ainda false — só liga de verdade em
 * /api/auth/2fa/verificar, depois de confirmar que o app autenticador do
 * usuário está sincronizado). Chamar de novo antes de confirmar substitui o
 * segredo anterior, sem problema.
 */
export async function POST() {
  const session = await auth()
  if (!session?.user?.contaId || !session.user.usuarioId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const secret = gerarSegredoTotp()
  const uri = totpUri(secret, session.user.email || 'Zybot')
  const qrCodeDataUrl = await QRCode.toDataURL(uri)

  await atualizarUsuario(session.user.contaId, session.user.usuarioId, { totpSecret: secret, totpAtivo: false })

  return NextResponse.json({ secret, uri, qrCodeDataUrl })
}
