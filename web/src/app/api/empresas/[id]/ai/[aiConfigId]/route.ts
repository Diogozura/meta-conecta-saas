import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { removeAiConfig, updateAiConfig } from '@/lib/companiesApi'

type RouteParams = { params: Promise<{ id: string; aiConfigId: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, aiConfigId } = await params
    const payload = await req.json()
    const result = await updateAiConfig(id, aiConfigId, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, aiConfigId } = await params
    const result = await removeAiConfig(id, aiConfigId)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
