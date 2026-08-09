import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { removeWhatsApp, updateWhatsApp } from '@/lib/companiesApi'

type RouteParams = { params: Promise<{ id: string; whatsappId: string }> }

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, whatsappId } = await params
    const payload = await req.json()
    const result = await updateWhatsApp(id, whatsappId, payload)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

// 409 se for o último número da empresa (o backend exige ao menos 1).
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const { id, whatsappId } = await params
    const result = await removeWhatsApp(id, whatsappId)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}
