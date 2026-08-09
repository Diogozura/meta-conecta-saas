import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarProfissional, obterProfissional } from '@/lib/firestore'
import { exchangeGoogleCode } from '@/lib/googleCalendar'

const AGENDA_URL = '/dashboard/agenda'

// GET /api/agenda/google/callback - callback do consentimento OAuth do Google
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')

  const redirectWithStatus = (status: string) =>
    NextResponse.redirect(new URL(`${AGENDA_URL}?google=${status}`, req.url))

  if (error || !code || !state) {
    return redirectWithStatus('erro')
  }

  const session = await auth()
  if (!session?.user?.contaId) {
    return redirectWithStatus('nao_autenticado')
  }

  let parsedState: { contaId?: string; profissionalId?: string }
  try {
    parsedState = JSON.parse(Buffer.from(state, 'base64url').toString('utf8'))
  } catch {
    return redirectWithStatus('erro')
  }

  if (!parsedState.contaId || !parsedState.profissionalId || parsedState.contaId !== session.user.contaId) {
    return redirectWithStatus('erro')
  }

  const profissional = await obterProfissional(session.user.contaId, parsedState.profissionalId)
  if (!profissional) {
    return redirectWithStatus('erro')
  }

  try {
    const { refreshToken, email } = await exchangeGoogleCode(code)
    await atualizarProfissional(session.user.contaId, parsedState.profissionalId, {
      google: {
        conectado: true,
        calendarId: 'primary',
        refreshTokenEnc: refreshToken,
        email,
      },
    })
    return redirectWithStatus('conectado')
  } catch (err) {
    console.error('Erro ao trocar code do Google por token:', err)
    return redirectWithStatus('erro')
  }
}
