import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { disconnectMeta } from '@/lib/companiesApi'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const result = await disconnectMeta(id)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
