import { NextRequest, NextResponse } from 'next/server'
import { getBackendUser, getSessionCookieValue } from '@/lib/auth'
import { backendErrorResponse } from '@/lib/apiRouteHelpers'
import { deleteUser, updateUser } from '@/lib/usersApi'

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const { id } = await params
    const payload = await req.json()
    const result = await updateUser(sessionCookie, id, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const user = await getBackendUser()
  const sessionCookie = await getSessionCookieValue()
  if (!user || !sessionCookie) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const { id } = await params
    await deleteUser(sessionCookie, id)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
