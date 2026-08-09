import { NextRequest, NextResponse } from 'next/server'
import { getBackendUser, getSessionCookieValue } from '@/lib/auth'
import { backendErrorResponse } from '@/lib/apiRouteHelpers'
import { createUser, listUsers } from '@/lib/usersApi'

// GET /api/usuarios - Lista os usuários da empresa do usuário autenticado
export async function GET() {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const usuarios = await listUsers(sessionCookie)
    return NextResponse.json({ usuarios })
  } catch (error) {
    return backendErrorResponse(error)
  }
}

// POST /api/usuarios - Cria um usuário vinculado à empresa do usuário autenticado
export async function POST(req: NextRequest) {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const payload = await req.json()
    const result = await createUser(sessionCookie, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
