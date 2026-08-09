/**
 * Cliente HTTP para o backend FastAPI de Usuários.
 *
 * Diferente de companiesApi.ts (que usa a chave de admin de plataforma),
 * aqui a autenticação é por usuário: o cookie de sessão do Next é
 * reenviado como `Authorization: Bearer <cookie>`, e o backend valida
 * tanto ID Tokens quanto session cookies (ver
 * backend/app/auth/firebase_auth.py). O backend resolve o `company_id`
 * a partir desse token — nunca aceita `company_id` vindo do frontend.
 */
import { BackendApiError, formatBackendDetail } from '@/lib/companiesApi'
import type { UserCreateInput, UserCreateResponse, UserResponse, UserUpdateInput } from '@/types/user'

async function backendFetch<T>(sessionCookie: string, path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.BACKEND_API_URL
  if (!baseUrl) {
    throw new BackendApiError(500, 'BACKEND_API_URL não configurada em web/.env.local')
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionCookie}`,
      ...init?.headers,
    },
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)

  if (!res.ok) {
    throw new BackendApiError(res.status, formatBackendDetail(body?.detail, res.status))
  }

  return body as T
}

export function listUsers(sessionCookie: string): Promise<UserResponse[]> {
  return backendFetch(sessionCookie, '/users')
}

export function createUser(sessionCookie: string, payload: UserCreateInput): Promise<UserCreateResponse> {
  return backendFetch(sessionCookie, '/users', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateUser(sessionCookie: string, id: string, payload: UserUpdateInput): Promise<UserResponse> {
  return backendFetch(sessionCookie, `/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function updateUserStatus(sessionCookie: string, id: string, status: 'ativo' | 'inativo'): Promise<UserResponse> {
  return backendFetch(sessionCookie, `/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
}

export function deleteUser(sessionCookie: string, id: string): Promise<void> {
  return backendFetch(sessionCookie, `/users/${id}`, { method: 'DELETE' })
}

/** Perfil do usuário autenticado (quem sou eu, em que empresa, com qual nível de acesso). */
export function getMe(sessionCookie: string): Promise<Omit<UserResponse, 'created_at'>> {
  return backendFetch(sessionCookie, '/auth/me')
}
