/**
 * Tipos espelhando os schemas Pydantic do backend
 * (backend/app/schemas/user_schema.py, backend/app/models/user.py).
 */

export type AccessLevel = 'administrador' | 'supervisor' | 'atendente'
export type UserStatus = 'ativo' | 'inativo'

export interface UserResponse {
  id: string
  company_id: string
  name: string
  email: string
  role: string
  access_level: AccessLevel
  sector: string | null
  status: UserStatus
  created_at: string
}

export interface UserCreateInput {
  name: string
  email: string
  role: string
  access_level: AccessLevel
  sector?: string | null
}

export interface UserUpdateInput {
  name?: string
  role?: string
  access_level?: AccessLevel
  sector?: string | null
}

export interface UserCreateResponse {
  user: UserResponse
  invite_link: string
}
