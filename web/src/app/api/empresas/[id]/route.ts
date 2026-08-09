import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { deleteCompany, getCompany, updateCompany } from '@/lib/companiesApi'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const result = await getCompany(id)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const payload = await req.json()
    const result = await updateCompany(id, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

// Soft delete — o backend nunca remove o documento de verdade.
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const result = await deleteCompany(id)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
