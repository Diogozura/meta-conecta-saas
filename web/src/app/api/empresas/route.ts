import { NextRequest, NextResponse } from 'next/server'
import { backendErrorResponse, requirePlatformAdmin } from '@/lib/apiRouteHelpers'
import { createCompany, listCompanies } from '@/lib/companiesApi'
import type { CompanyStatus, ListCompaniesParams, MetaConnectionStatus } from '@/types/company'

// GET /api/empresas - Lista empresas (busca/filtros/paginação via query params)
export async function GET(req: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const sp = req.nextUrl.searchParams
    const params: ListCompaniesParams = {
      limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
      cursor: sp.get('cursor') ?? undefined,
      status: (sp.get('status') as CompanyStatus | null) ?? undefined,
      meta_status: (sp.get('meta_status') as MetaConnectionStatus | null) ?? undefined,
      ai_enabled: sp.get('ai_enabled') ? sp.get('ai_enabled') === 'true' : undefined,
      plan_name: sp.get('plan_name') ?? undefined,
      q: sp.get('q') ?? undefined,
      search_by: (sp.get('search_by') as ListCompaniesParams['search_by']) ?? undefined,
    }
    const result = await listCompanies(params)
    return NextResponse.json(result)
  } catch (error) {
    return backendErrorResponse(error)
  }
}

// POST /api/empresas - Cria uma nova empresa
export async function POST(req: NextRequest) {
  const denied = await requirePlatformAdmin()
  if (denied) return denied

  try {
    const payload = await req.json()
    const result = await createCompany(payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return backendErrorResponse(error)
  }
}
