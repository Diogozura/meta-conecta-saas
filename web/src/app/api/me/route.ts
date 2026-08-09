import { NextResponse } from 'next/server'
import { getBackendUser, getSessionCookieValue } from '@/lib/auth'
import { backendErrorResponse } from '@/lib/apiRouteHelpers'
import { getMe } from '@/lib/usersApi'

// GET /api/me - Perfil do usuário autenticado (empresa, cargo, nível de acesso)
export async function GET() {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const me = await getMe(sessionCookie)
    return NextResponse.json(me)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
