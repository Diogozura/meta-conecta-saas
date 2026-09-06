/**
 * Integração com o Canva Connect API — usada só pra importar um design
 * pronto (exportado como imagem/vídeo) pra publicar no Instagram, ver
 * PublishTab.tsx. OAuth 2.0 com PKCE (a Canva exige — não aceita client
 * secret sozinho pra trocar o código de autorização).
 */

import { randomBytes, createHash } from 'crypto'
import { obterCanvaAccess, salvarCanvaAccess } from '@/lib/firestore'

const CANVA_AUTH_URL = 'https://www.canva.com/api/oauth/authorize'
const CANVA_TOKEN_URL = 'https://api.canva.com/rest/v1/oauth/token'
const CANVA_API_BASE = 'https://api.canva.com/rest/v1'
const CANVA_SCOPES = 'design:content:read design:meta:read'

export class CanvaApiError extends Error {}

function getRedirectUri(): string {
  return process.env.CANVA_REDIRECT_URI ?? 'https://www.zybot.com.br/api/canva/callback'
}

function basicAuthHeader(): string {
  const raw = `${process.env.CANVA_CLIENT_ID ?? ''}:${process.env.CANVA_CLIENT_SECRET ?? ''}`
  return 'Basic ' + Buffer.from(raw).toString('base64')
}

/** Par PKCE — o verifier fica guardado num cookie até o callback voltar (ver api/canva/authorize). */
export function gerarParPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString('base64url').slice(0, 128)
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

export function getCanvaAuthorizeUrl(challenge: string, state: string): string {
  const url = new URL(CANVA_AUTH_URL)
  url.searchParams.set('code_challenge_method', 's256')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', process.env.CANVA_CLIENT_ID ?? '')
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('scope', CANVA_SCOPES)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('state', state)
  return url.toString()
}

interface CanvaTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
}

export async function exchangeCodeForToken(code: string, verifier: string): Promise<CanvaTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: getRedirectUri(),
  })
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new CanvaApiError('Falha ao trocar o código do Canva pelo token de acesso')
  return res.json()
}

async function refreshAccessToken(refreshToken: string): Promise<CanvaTokenResponse> {
  const body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken })
  const res = await fetch(CANVA_TOKEN_URL, {
    method: 'POST',
    headers: { Authorization: basicAuthHeader(), 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new CanvaApiError('Falha ao renovar o token do Canva — pode ser preciso reconectar')
  return res.json()
}

/**
 * Devolve um access token válido, renovando sozinho se estiver perto de vencer — cada refresh
 * token do Canva só pode ser usado 1 vez, então o novo par (access+refresh) já é salvo de volta.
 */
export async function obterCanvaAccessTokenValido(contaId: string): Promise<string | null> {
  const acesso = await obterCanvaAccess(contaId)
  if (!acesso) return null

  const prestesAVencer = acesso.expiraEm.getTime() - Date.now() < 5 * 60 * 1000
  if (!prestesAVencer) return acesso.accessToken

  const renovado = await refreshAccessToken(acesso.refreshToken)
  await salvarCanvaAccess(contaId, {
    accessToken: renovado.access_token,
    refreshToken: renovado.refresh_token,
    expiraEm: new Date(Date.now() + renovado.expires_in * 1000),
  })
  return renovado.access_token
}

async function canvaFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${CANVA_API_BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new CanvaApiError(err?.message ?? `Falha na chamada à API do Canva (${path})`)
  }
  return res.json()
}

export interface CanvaDesign {
  id: string
  title?: string
  thumbnail?: { url?: string; width?: number; height?: number }
}

export async function listDesigns(accessToken: string, query?: string, continuation?: string): Promise<{ items: CanvaDesign[]; continuation?: string }> {
  const params = new URLSearchParams({ limit: '24' })
  if (query) params.set('query', query)
  if (continuation) params.set('continuation', continuation)
  return canvaFetch(`/designs?${params.toString()}`, accessToken)
}

export type CanvaExportFormat = { type: 'png' } | { type: 'jpg'; quality?: number } | { type: 'mp4' }

export async function createExportJob(accessToken: string, designId: string, format: CanvaExportFormat): Promise<{ job: { id: string; status: string } }> {
  return canvaFetch('/exports', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ design_id: designId, format }),
  })
}

export interface CanvaExportJobStatus {
  job: { id: string; status: 'in_progress' | 'success' | 'failed'; urls?: string[]; error?: { message?: string } }
}

export async function getExportJob(accessToken: string, jobId: string): Promise<CanvaExportJobStatus> {
  return canvaFetch(`/exports/${jobId}`, accessToken)
}
