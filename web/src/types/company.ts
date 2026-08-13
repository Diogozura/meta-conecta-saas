/**
 * Tipos espelhando 1:1 os schemas Pydantic do backend
 * (backend/app/schemas/company_schema.py). Mantidos em snake_case de
 * propósito: as API routes de proxy (src/app/api/empresas) repassam o JSON
 * do FastAPI sem tradução de campo.
 */

export interface ClientInfo {
  name: string
  email: string
}

export interface WhatsAppNumber {
  id: string
  number: string
  label: string
  active: boolean
}

export interface WhatsAppNumberInput {
  number: string
  label: string
  active: boolean
}

export interface WhatsAppNumberUpdateInput {
  number?: string
  label?: string
  active?: boolean
}

export type MetaConnectionStatus = 'inactive' | 'connected'

export interface MetaConnectionInfo {
  status: MetaConnectionStatus
  phone_number_id: string
  business_account_id: string
  last_sync: string | null
}

export interface MetaConnectionConnectInput {
  phone_number_id: string
  business_account_id: string
  access_token: string
}

export type AIProvider = 'openai' | 'anthropic' | 'gemini'
export type AIPurpose = 'mensagem' | 'imagem' | 'audio' | 'outro'

export interface AIProviderConfig {
  id: string
  label: string
  purpose: AIPurpose
  provider: AIProvider
  model: string
  assistant_id: string | null
  prompt: string | null
  temperature: number
  enabled: boolean
  has_api_key: boolean
}

export interface AIProviderConfigInput {
  label: string
  purpose: AIPurpose
  provider: AIProvider
  model: string
  api_key: string
  assistant_id?: string | null
  prompt?: string | null
  temperature?: number
  enabled?: boolean
}

export interface AIProviderConfigUpdateInput {
  label?: string
  purpose?: AIPurpose
  provider?: AIProvider
  model?: string
  api_key?: string
  assistant_id?: string | null
  prompt?: string | null
  temperature?: number
  enabled?: boolean
}

export interface PlanInfo {
  name: string
  expires_at: string | null
  messages_limit: number | null
}

export interface PlanUpdateInput {
  name?: string
  expires_at?: string | null
  messages_limit?: number | null
}

export interface UsageInfo {
  messages_this_month: number
  tokens_this_month: number
  last_message_at: string | null
}

export type CompanyStatus = 'active' | 'inactive' | 'deleted'

export interface CompanyResponse {
  id: string
  company_name: string
  cnpj: string
  client: ClientInfo
  sector: string
  whatsapp: WhatsAppNumber[]
  meta_connection: MetaConnectionInfo
  tags: string[]
  ai: AIProviderConfig[]
  plan: PlanInfo
  usage: UsageInfo
  status: CompanyStatus
  created_at: string
  updated_at: string
  created_by: string
}

export interface CompanyListItem {
  id: string
  company_name: string
  client_name: string
  client_email: string
  sector: string
  plan_name: string
  whatsapp_count: number
  ai_enabled: boolean
  meta_connection_status: MetaConnectionStatus
  status: CompanyStatus
  created_at: string
}

export interface CompanyListResponse {
  items: CompanyListItem[]
  next_cursor: string | null
}

export interface CompanyCreateInput {
  company_name: string
  cnpj: string
  client: ClientInfo
  sector: string
  whatsapp: WhatsAppNumberInput[]
  tags: string[]
  ai?: AIProviderConfigInput[]
  plan: PlanInfo
}

export interface CompanyUpdateInput {
  company_name?: string
  cnpj?: string
  client?: ClientInfo
  sector?: string
  tags?: string[]
}

export interface CompanyCreateResponse {
  company: CompanyResponse
  admin_invite_link: string
}

export interface ListCompaniesParams {
  limit?: number
  cursor?: string
  status?: CompanyStatus
  meta_status?: MetaConnectionStatus
  ai_enabled?: boolean
  plan_name?: string
  q?: string
  search_by?: 'name' | 'email' | 'cnpj' | 'tag'
}
