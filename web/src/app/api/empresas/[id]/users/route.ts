import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { createCompanyUser, listCompanyUsers } from '@/lib/companiesApi'

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
    const users = await listCompanyUsers(id, cursor)
    return NextResponse.json({ users })
  } catch (error) {
    return backendErrorResponse(error)
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id } = await params
    const payload = await req.json()
    const result = await createCompanyUser(id, payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
