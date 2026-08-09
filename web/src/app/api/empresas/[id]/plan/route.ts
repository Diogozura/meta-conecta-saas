import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { updatePlan } from '@/lib/companiesApi'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const payload = await req.json()
    const result = await updatePlan(id, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
