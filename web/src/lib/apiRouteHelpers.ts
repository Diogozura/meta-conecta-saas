import { NextResponse } from 'next/server'
import { BackendApiError } from '@/lib/companiesApi'
import { getSessionWithPlatformAdmin } from '@/lib/auth'

/** Repassa o status/detail reais do backend FastAPI para a resposta da API route. */
export function backendErrorResponse(error: unknown) {
  if (error instanceof BackendApiError) {
    return NextResponse.json({ error: error.detail }, { status: error.status })
  }
  console.error('Erro ao chamar o backend de empresas:', error)
  return NextResponse.json({ error: 'Erro interno ao chamar o backend.' }, { status: 500 })
}

/**
 * Resposta padrão pra quando `auth()`/`getBackendUser()` lançam
 * FirestoreQuotaExceededError (só acontece pra admin de plataforma — ver
 * auth.ts). Use no catch de qualquer rota que chama essas funções:
 * `if (error instanceof FirestoreQuotaExceededError) return quotaErrorResponse()`.
 */
export function quotaErrorResponse() {
  return NextResponse.json(
    { error: 'Passou do limite diário de requisição do Firebase. Tente novamente em alguns minutos.', code: 'firestore_quota_exceeded' },
    { status: 503 }
  )
}

/**
 * Guarda de todas as rotas /api/empresas/**: exige não só estar logado, mas
 * estar na lista PLATFORM_ADMIN_EMAILS — essas rotas usam a chave de admin
 * do backend (BACKEND_ADMIN_KEY) e dão acesso a TODAS as empresas, nunca
 * devem ser alcançáveis por um usuário comum só por estar autenticado.
 *
 * Uso: `const denied = await requirePlatformAdmin(); if (denied) return denied`
 */
export async function requirePlatformAdmin(): Promise<NextResponse | null> {
  const { session, isPlatformAdmin } = await getSessionWithPlatformAdmin()
  if (!session) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Acesso restrito a administradores da plataforma.' }, { status: 403 })
  }
  return null
}
