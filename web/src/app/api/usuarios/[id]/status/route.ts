import { NextRequest, NextResponse } from 'next/server'
import { getBackendUser, getSessionCookieValue } from '@/lib/auth'
import { backendErrorResponse } from '@/lib/apiRouteHelpers'
import { updateUserStatus } from '@/lib/usersApi'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const { status } = await req.json()
    const result = await updateUserStatus(sessionCookie, id, status)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
