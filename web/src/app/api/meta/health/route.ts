import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterMetaAccess } from '@/lib/firestore'
import { debugAccessToken, WHATSAPP_REQUIRED_SCOPES } from '@/lib/meta'

// GET /api/meta/health - Verificação ATIVA da permissão/conexão do WhatsApp: chama a Graph API
// (debug_token) pra confirmar se o token salvo ainda é válido e quais escopos ele realmente tem —
// diferente de /api/meta/credentials, que só lê o que está gravado no Firestore.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    return NextResponse.json({ conectado: false, motivo: 'WhatsApp ainda não conectado nessa conta' })
  }

  if (metaAccess.desconectadoEm) {
    return NextResponse.json({
      conectado: true,
      tokenValido: false,
      motivo: 'Desconectado pelo WhatsApp Business App no celular — precisa reconectar',
      desconectadoEm: metaAccess.desconectadoEm,
    })
  }

  try {
    const resultado = await debugAccessToken(metaAccess.businessToken, metaAccess.appId, metaAccess.appSecret)
    const escopos = resultado.scopes ?? []
    const escoposFaltando = WHATSAPP_REQUIRED_SCOPES.filter((s) => !escopos.includes(s))

    return NextResponse.json({
      conectado: true,
      tokenValido: !!resultado.is_valid,
      expiraEm: resultado.expires_at ? new Date(resultado.expires_at * 1000).toISOString() : null,
      escopos,
      escoposFaltando,
      wabaId: metaAccess.wabaId,
      phoneNumberId: metaAccess.phoneNumberId,
      numerosAdicionais: metaAccess.numerosAdicionais ?? [],
      erro: resultado.error?.message,
    })
  } catch (error) {
    return NextResponse.json({
      conectado: true,
      tokenValido: false,
      motivo: error instanceof Error ? error.message : 'Erro desconhecido ao verificar o token na Meta',
    })
  }
}
