import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { addAiConfig } from '@/lib/companiesApi'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const payload = await req.json()
    const result = await addAiConfig(id, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
