/**
 * Cliente HTTP para o backend FastAPI de Gerenciamento de Empresas.
 * Uso exclusivo das API routes em src/app/api/empresas — nunca importar
 * a partir de um componente 'use client', já que BACKEND_ADMIN_KEY só pode
 * viver no servidor.
 */
import type {
  AIProviderConfigInput,
  AIProviderConfigUpdateInput,
  CompanyCreateInput,
  CompanyCreateResponse,
  CompanyListResponse,
  CompanyResponse,
  CompanyUpdateInput,
  ListCompaniesParams,
  MetaConnectionConnectInput,
  PlanUpdateInput,
  WhatsAppNumberInput,
  WhatsAppNumberUpdateInput,
} from '@/types/company'
import type { UserCreateInput, UserCreateResponse, UserResponse, UserStatus, UserUpdateInput } from '@/types/user'

export class BackendApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.status = status
    this.detail = detail
  }
}

/**
 * Erros de negócio (404/409/401) vêm do FastAPI como {detail: "mensagem"}.
 * Erros de validação do Pydantic (422) vêm como
 * {detail: [{msg: "Value error, CNPJ inválido.", loc: [...], ...}, ...]} —
 * aqui extraímos só as mensagens legíveis em vez de jogar o JSON cru pro usuário.
 */
export function formatBackendDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => (item && typeof item === 'object' && 'msg' in item ? String(item.msg) : null))
      .filter((msg): msg is string => Boolean(msg))
      .map((msg) => msg.replace(/^Value error,\s*/, ''))
    if (messages.length) return messages.join(' ')
  }

  return detail ? JSON.stringify(detail) : `Erro ${status} ao chamar o backend.`
}

async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const baseUrl = process.env.BACKEND_API_URL
  if (!baseUrl) {
    throw new BackendApiError(500, 'BACKEND_API_URL não configurada em web/.env.local')
  }

  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Platform-Admin-Key': process.env.BACKEND_ADMIN_KEY ?? '',
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

function toQueryString(params: object): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      search.set(key, String(value))
    }
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

export function listCompanies(params: ListCompaniesParams): Promise<CompanyListResponse> {
  return backendFetch(`/companies${toQueryString(params)}`)
}

export function getCompany(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}`)
}

export function createCompany(payload: CompanyCreateInput): Promise<CompanyCreateResponse> {
  return backendFetch('/companies', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCompany(id: string, payload: CompanyUpdateInput): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function activateCompany(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/activate`, { method: 'PATCH' })
}

export function deactivateCompany(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/deactivate`, { method: 'PATCH' })
}

export function restoreCompany(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/restore`, { method: 'PATCH' })
}

export function deleteCompany(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}`, { method: 'DELETE' })
}

export function addWhatsApp(id: string, payload: WhatsAppNumberInput): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/whatsapp`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateWhatsApp(
  id: string,
  whatsappId: string,
  payload: WhatsAppNumberUpdateInput
): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/whatsapp/${whatsappId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function removeWhatsApp(id: string, whatsappId: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/whatsapp/${whatsappId}`, { method: 'DELETE' })
}

export function connectMeta(id: string, payload: MetaConnectionConnectInput): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/meta/connect`, { method: 'POST', body: JSON.stringify(payload) })
}

export function disconnectMeta(id: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/meta/disconnect`, { method: 'POST' })
}

export function addAiConfig(id: string, payload: AIProviderConfigInput): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/ai`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateAiConfig(
  id: string,
  aiConfigId: string,
  payload: AIProviderConfigUpdateInput
): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/ai/${aiConfigId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function removeAiConfig(id: string, aiConfigId: string): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/ai/${aiConfigId}`, { method: 'DELETE' })
}

export function updatePlan(id: string, payload: PlanUpdateInput): Promise<CompanyResponse> {
  return backendFetch(`/companies/${id}/plan`, { method: 'PUT', body: JSON.stringify(payload) })
}

// --- Usuários da empresa (visão do admin de plataforma) ---------------------
// Diferente de usersApi.ts (auto-atendimento do próprio usuário logado, via
// Bearer token), aqui é o admin de plataforma vendo/gerenciando os usuários
// de QUALQUER empresa, autenticado pela mesma chave de admin deste arquivo.

export function listCompanyUsers(id: string, cursor?: string): Promise<UserResponse[]> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
  return backendFetch(`/companies/${id}/users${query}`)
}

export function createCompanyUser(id: string, payload: UserCreateInput): Promise<UserCreateResponse> {
  return backendFetch(`/companies/${id}/users`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateCompanyUser(id: string, userId: string, payload: UserUpdateInput): Promise<UserResponse> {
  return backendFetch(`/companies/${id}/users/${userId}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function updateCompanyUserStatus(id: string, userId: string, status: UserStatus): Promise<UserResponse> {
  return backendFetch(`/companies/${id}/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  })
}

export function deleteCompanyUser(id: string, userId: string): Promise<void> {
  return backendFetch(`/companies/${id}/users/${userId}`, { method: 'DELETE' })
}
