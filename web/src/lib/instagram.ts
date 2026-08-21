/**
 * Integração com "Business Login for Instagram" — OAuth direto com a conta
 * profissional do Instagram, sem precisar de Página do Facebook no meio
 * (diferente do Embedded Signup do WhatsApp, que usa o SDK do Facebook).
 */

const IG_GRAPH_API = 'https://graph.instagram.com'

function getRedirectUri() {
  // Precisa bater EXATAMENTE com a URL cadastrada em "Login do Instagram
  // para Empresas" no App Dashboard (Redirect URIs).
  return process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI ?? 'https://www.zybot.com.br/api/instagram/callback'
}

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
].join(',')

/** Monta a URL de autorização — usada num link/botão simples, sem SDK. */
export function getInstagramAuthorizeUrl(state: string): string {
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('force_reauth', 'true')
  url.searchParams.set('client_id', process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID ?? '')
  url.searchParams.set('redirect_uri', getRedirectUri())
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('state', state)
  return url.toString()
}

/** Troca o código de autorização (válido por 1h, uso único) por um token de curta duração. */
export async function exchangeCodeForShortLivedToken(code: string): Promise<{ access_token: string; user_id: string }> {
  const redirectUri = getRedirectUri()
  // Log temporário pra diagnosticar o erro "redirect_uri is identical" — dá
  // pra comparar caractere a caractere com o que a Meta recebeu no /authorize.
  console.log('[Instagram] Trocando código por token. redirect_uri enviado:', JSON.stringify(redirectUri))

  // multipart/form-data, não urlencoded — é o formato que o exemplo oficial
  // da Meta usa (curl -F); o fetch monta o boundary sozinho a partir do
  // FormData, então não seta Content-Type manualmente aqui.
  const form = new FormData()
  form.set('client_id', process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID ?? '')
  form.set('client_secret', process.env.INSTAGRAM_APP_SECRET ?? '')
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', redirectUri)
  form.set('code', code)

  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json()
    console.error('[Instagram] Erro completo da Meta na troca de token:', JSON.stringify(err))
    throw new Error(err?.error_message ?? 'Falha ao trocar o código de autorização')
  }

  // A resposta vem embrulhada em { data: [{ access_token, user_id, permissions }] },
  // não como objeto plano — sem isso, access_token fica undefined e a troca
  // pelo token de longa duração falha com um erro genérico da Graph API.
  const json = await res.json()
  const short = Array.isArray(json?.data) ? json.data[0] : json
  // Log temporário — token mascarado (só tamanho e prefixo), pra confirmar
  // que o valor que vamos usar na próxima chamada é mesmo um token válido.
  console.log(
    '[Instagram] Resposta bruta do short-lived token. chaves:', JSON.stringify(Object.keys(json)),
    '| shape:', Array.isArray(json?.data) ? 'wrapped em data[]' : 'plano',
    '| access_token:', short?.access_token ? `${String(short.access_token).slice(0, 8)}... (len ${String(short.access_token).length})` : 'AUSENTE',
  )
  if (!short?.access_token) {
    console.error('[Instagram] Resposta inesperada da Meta na troca de token:', JSON.stringify(json))
    throw new Error('Resposta inesperada da Meta ao trocar o código de autorização')
  }
  return short
}

/** Troca o token de curta duração por um long-lived token (60 dias). */
export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${IG_GRAPH_API}/access_token`)
  url.searchParams.set('grant_type', 'ig_exchange_token')
  url.searchParams.set('client_secret', process.env.INSTAGRAM_APP_SECRET ?? '')
  url.searchParams.set('access_token', shortLivedToken)

  // Log temporário — confirma exatamente o que está sendo enviado (token
  // mascarado) nessa chamada que está falhando.
  console.log(
    '[Instagram] Trocando por token de longa duração. access_token recebido:',
    shortLivedToken ? `${shortLivedToken.slice(0, 8)}... (len ${shortLivedToken.length})` : 'AUSENTE/UNDEFINED',
    '| URL (sem secret):', url.toString().replace(/client_secret=[^&]+/, 'client_secret=REDACTED'),
  )

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    console.error('[Instagram] Erro ao trocar por token de longa duração:', JSON.stringify(err))
    throw new Error(err?.error?.message ?? 'Falha ao gerar o token de longa duração')
  }
  return res.json()
}

/** Renova um long-lived token que já tenha pelo menos 24h (bom rodar via cron antes dos 60 dias vencerem). */
export async function refreshLongLivedToken(longLivedToken: string): Promise<{ access_token: string; expires_in: number }> {
  const url = new URL(`${IG_GRAPH_API}/refresh_access_token`)
  url.searchParams.set('grant_type', 'ig_refresh_token')
  url.searchParams.set('access_token', longLivedToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao renovar o token')
  }
  return res.json()
}

/** Busca os dados básicos da conta profissional conectada. */
export async function getInstagramProfile(
  accessToken: string,
): Promise<{ id: string; username: string; account_type?: string; profile_picture_url?: string }> {
  const url = new URL(`${IG_GRAPH_API}/me`)
  url.searchParams.set('fields', 'id,username,account_type,profile_picture_url')
  url.searchParams.set('access_token', accessToken)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    console.error('[Instagram] Erro ao buscar perfil:', JSON.stringify(err))
    throw new Error(err?.error?.message ?? 'Falha ao buscar o perfil do Instagram')
  }
  return res.json()
}
