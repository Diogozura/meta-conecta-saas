import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { deleteCompanyUser, updateCompanyUser } from '@/lib/companiesApi'

type RouteParams = { params: Promise<{ id: string; userId: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, userId } = await params
    const payload = await req.json()
    const result = await updateCompanyUser(id, userId, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, userId } = await params
    await deleteCompanyUser(id, userId)
    return new NextResponse(null, { status: 204 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
