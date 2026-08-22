import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterMetaAccess, adicionarNumeroWhatsapp } from '@/lib/firestore'
import { registerPhoneNumber } from '@/lib/meta'

// GET /api/meta/numeros - Lista o número principal + os adicionais registrados na conta.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    return NextResponse.json({ error: 'WhatsApp ainda não conectado' }, { status: 404 })
  }

  return NextResponse.json({
    principal: metaAccess.phoneNumberId,
    numerosAdicionais: metaAccess.numerosAdicionais ?? [],
  })
}

/**
 * POST /api/meta/numeros - Registra mais um número de WhatsApp na MESMA WABA
 * já conectada (ex: uma loja física por número). O phoneNumberId é obtido
 * pelo dono da conta no Meta Business Manager > WhatsApp Manager > Números
 * — não existe fluxo de OAuth pra "adicionar número" além do primeiro
 * (Embedded Signup só conecta um por vez).
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const phoneNumberId = typeof body?.phoneNumberId === 'string' ? body.phoneNumberId.trim() : ''
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  if (!phoneNumberId || !nome) {
    return NextResponse.json({ error: 'phoneNumberId e nome são obrigatórios' }, { status: 400 })
  }

  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    return NextResponse.json({ error: 'WhatsApp ainda não conectado' }, { status: 404 })
  }
  if (phoneNumberId === metaAccess.phoneNumberId || metaAccess.numerosAdicionais?.some((n) => n.phoneNumberId === phoneNumberId)) {
    return NextResponse.json({ error: 'Esse número já está registrado nessa conta' }, { status: 409 })
  }

  try {
    await registerPhoneNumber(phoneNumberId, metaAccess.businessToken)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return NextResponse.json({ error: `Falha ao registrar o número na Meta: ${message}` }, { status: 502 })
  }

  try {
    const atualizado = await adicionarNumeroWhatsapp(session.user.contaId, metaAccess.id, { phoneNumberId, nome })
    return NextResponse.json({ numerosAdicionais: atualizado.numerosAdicionais ?? [] }, { status: 201 })
  } catch (error) {
    console.error('Erro ao salvar número adicional:', error)
    return NextResponse.json({ error: 'Número registrado na Meta, mas houve erro ao salvar no painel — tente adicionar de novo' }, { status: 500 })
  }
}
