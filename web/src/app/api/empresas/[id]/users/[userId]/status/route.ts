import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { updateCompanyUserStatus } from '@/lib/companiesApi'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, userId } = await params
    const { status } = await req.json()
    const result = await updateCompanyUserStatus(id, userId, status)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
