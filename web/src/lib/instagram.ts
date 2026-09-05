/**
 * Integração com "Business Login for Instagram" — OAuth direto com a conta
 * profissional do Instagram, sem precisar de Página do Facebook no meio
 * (diferente do Embedded Signup do WhatsApp, que usa o SDK do Facebook).
 */

import { auth } from '@/lib/auth'
import { obterInstagramAccess } from '@/lib/firestore'

const IG_GRAPH_API = 'https://graph.instagram.com'
// v22.0+ é o que introduziu metric_type=total_value pras métricas agregadas e os breakdowns
// (contact_button_type, follow_type etc) usados em getAccountInsights — não fica em v21.0.
const IG_GRAPH_API_VERSION = 'v22.0'

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

/** Busca a conta + token do Instagram do usuário logado — mesmo padrão de getMetaCredentials(). */
export async function getInstagramCredentials() {
  const session = await auth()
  if (!session?.user?.contaId) {
    throw new Error('Usuário não autenticado')
  }

  const instagramAccess = await obterInstagramAccess(session.user.contaId)
  if (!instagramAccess) {
    throw new Error('Conta do Instagram não conectada. Acesse a página do Instagram para conectar.')
  }

  return instagramAccess
}

export class InstagramApiError extends Error {
  code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'InstagramApiError'
    this.code = code
  }
}

async function igFetch<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const url = new URL(`${IG_GRAPH_API}/${IG_GRAPH_API_VERSION}/${path}`)
  const res = await fetch(url.toString(), {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new InstagramApiError(err?.error?.message ?? `Falha na chamada à API do Instagram (${path})`, err?.error?.code)
  }
  return res.json()
}

/* ─── Mensagens (DMs) ────────────────────────────────────────────────────── */

export interface InstagramConversationSummary {
  id: string
  updated_time?: string
  participants?: { data: Array<{ id: string; username?: string }> }
}

/** Lista as conversas (threads de DM) da conta conectada. */
export async function listConversations(accessToken: string): Promise<InstagramConversationSummary[]> {
  const data = await igFetch<{ data: InstagramConversationSummary[] }>(
    'me/conversations?platform=instagram&fields=id,updated_time,participants{id,username}',
    accessToken,
  )
  return data.data ?? []
}

export interface InstagramMessage {
  id: string
  from?: { id: string; username?: string }
  to?: { data: Array<{ id: string; username?: string }> }
  message?: string
  created_time?: string
}

/** Lista as mensagens de uma conversa específica. */
export async function listConversationMessages(accessToken: string, conversationId: string): Promise<InstagramMessage[]> {
  const data = await igFetch<{ messages: { data: InstagramMessage[] } }>(
    `${conversationId}?fields=messages.limit(50){id,from{id,username},to{id,username},message,created_time}`,
    accessToken,
  )
  return data.messages?.data ?? []
}

/** Envia uma DM de texto para um usuário do Instagram (Instagram-scoped ID). */
export async function sendDirectMessage(accessToken: string, recipientId: string, text: string): Promise<{ recipient_id: string; message_id: string }> {
  return igFetch('me/messages', accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  })
}

/* ─── Publicações e comentários ──────────────────────────────────────────── */

export interface InstagramMedia {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  comments_count?: number
  like_count?: number
}

/** Lista as publicações mais recentes da conta (para a aba de comentários, o histórico e a atividade recente). */
export async function listRecentMedia(accessToken: string, igUserId: string, limit = 25): Promise<InstagramMedia[]> {
  const data = await igFetch<{ data: InstagramMedia[] }>(
    `${igUserId}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,like_count&limit=${limit}`,
    accessToken,
  )
  return data.data ?? []
}

export interface InstagramComment {
  id: string
  text: string
  username?: string
  from?: { id: string; username?: string }
  timestamp?: string
}

/**
 * Lista os comentários de uma publicação. A Graph API só devolve o "username" de quem comentou
 * quando não é a própria conta profissional comentando (ex: uma resposta enviada por aqui) — nesse
 * caso ela devolve só um "from.id" igual ao igUserId da conta, sem username. Por isso só preenchemos
 * com o `owner.username` quando o comentário é realmente da própria conta; nos demais casos (usuário
 * de fato desconhecido pra API) deixamos undefined em vez de arriscar mostrar o nome errado.
 */
export async function listMediaComments(
  accessToken: string,
  mediaId: string,
  owner?: { igUserId: string; username: string },
): Promise<InstagramComment[]> {
  const data = await igFetch<{ data: InstagramComment[] }>(
    `${mediaId}/comments?fields=id,text,username,timestamp,from`,
    accessToken,
  )
  return (data.data ?? []).map((c) => {
    if (c.username) return c
    if (c.from?.username) return { ...c, username: c.from.username }
    if (owner && c.from?.id === owner.igUserId) return { ...c, username: owner.username }
    return c
  })
}

/** Responde um comentário. */
export async function replyToComment(accessToken: string, commentId: string, message: string): Promise<{ id: string }> {
  return igFetch(`${commentId}/replies`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })
}

/* ─── Publicação de conteúdo (posts, reels, vídeos, stories) ───────────────── */

export interface CreateMediaContainerParams {
  imageUrl?: string
  videoUrl?: string
  caption?: string
  mediaType: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
  /** Texto alternativo (acessibilidade) — só suportado em imagem avulsa, não em carrossel/reels/story. */
  altText?: string
  /** Até 3 @usuários convidados como colaboradores do post. */
  collaborators?: string[]
  /** Selo de "conteúdo gerado por IA" exigido pela Meta quando aplicável. */
  isAiGenerated?: boolean
  /** true ao criar um item filho de carrossel (não publica sozinho). */
  isCarouselItem?: boolean
  /** IDs dos containers filhos, só no container "pai" do carrossel (media_type=CAROUSEL). */
  children?: string[]
  /** Capa personalizada do Reels (imagem pública). Ignorada se thumbOffset também for enviado junto. */
  coverUrl?: string
  /** Reels: true = aparece no Feed e na aba Reels; false = só na aba Reels. */
  shareToFeed?: boolean
}

/** Cria o container de mídia — primeiro passo da publicação (a segunda etapa é publishContainer). */
export async function createMediaContainer(accessToken: string, igUserId: string, params: CreateMediaContainerParams): Promise<{ id: string }> {
  const body: Record<string, string> = {}
  if (params.imageUrl) body.image_url = params.imageUrl
  if (params.videoUrl) body.video_url = params.videoUrl
  if (params.caption) body.caption = params.caption
  if (params.mediaType !== 'IMAGE') body.media_type = params.mediaType
  if (params.altText) body.alt_text = params.altText
  if (params.collaborators?.length) body.collaborators = JSON.stringify(params.collaborators)
  if (params.isAiGenerated) body.is_ai_generated = 'true'
  if (params.isCarouselItem) body.is_carousel_item = 'true'
  if (params.children?.length) body.children = params.children.join(',')
  if (params.coverUrl) body.cover_url = params.coverUrl
  if (params.shareToFeed !== undefined) body.share_to_feed = String(params.shareToFeed)

  return igFetch(`${igUserId}/media`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Consulta o status de processamento de um container (vídeo/reels processam de forma assíncrona). */
export async function getContainerStatus(accessToken: string, containerId: string): Promise<{ status_code: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED' }> {
  return igFetch(`${containerId}?fields=status_code`, accessToken)
}

/** Publica um container já pronto (status_code === 'FINISHED'). */
export async function publishContainer(accessToken: string, igUserId: string, containerId: string): Promise<{ id: string }> {
  return igFetch(`${igUserId}/media_publish`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: containerId }),
  })
}

/**
 * Cria um container de vídeo/reels/story em modo "resumable" — o binário é
 * enviado depois, direto pra Meta (uploadResumableVideo), sem precisar
 * hospedar o arquivo em nenhum lugar público. Só existe pra vídeo: a Graph
 * API não tem upload binário pra foto, essa sempre exige image_url.
 */
export async function createResumableMediaContainer(
  accessToken: string,
  igUserId: string,
  mediaType: 'VIDEO' | 'REELS' | 'STORIES',
  options: {
    caption?: string
    isCarouselItem?: boolean
    collaborators?: string[]
    isAiGenerated?: boolean
    coverUrl?: string
    shareToFeed?: boolean
  } = {},
): Promise<{ id: string }> {
  const body: Record<string, string> = { upload_type: 'resumable', media_type: mediaType }
  if (options.caption) body.caption = options.caption
  if (options.isCarouselItem) body.is_carousel_item = 'true'
  if (options.collaborators?.length) body.collaborators = JSON.stringify(options.collaborators)
  if (options.isAiGenerated) body.is_ai_generated = 'true'
  if (options.coverUrl) body.cover_url = options.coverUrl
  if (options.shareToFeed !== undefined) body.share_to_feed = String(options.shareToFeed)

  return igFetch(`${igUserId}/media`, accessToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

/** Sobe o binário do vídeo direto pro servidor de upload da Meta (rupload.facebook.com). */
export async function uploadResumableVideo(accessToken: string, containerId: string, buffer: Buffer): Promise<void> {
  const url = `https://rupload.facebook.com/ig-api-upload/${IG_GRAPH_API_VERSION}/${containerId}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `OAuth ${accessToken}`,
      offset: '0',
      file_size: String(buffer.length),
    },
    body: new Uint8Array(buffer),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => null)
    throw new InstagramApiError(err?.error?.message ?? 'Falha no upload do vídeo para a Meta', err?.error?.code)
  }
}

/* ─── Menções (@usuário em comentário ou legenda) ───────────────────────── */
// A Graph API não tem um endpoint pra "listar menções" — só é possível saber
// de uma menção quando o webhook (field "mentions") avisa, e então buscar o
// detalhe (comentário ou mídia) pelo ID que o webhook informou.

export interface MentionedComment {
  id: string
  text?: string
  username?: string
  timestamp?: string
  media?: { id: string }
}

/** Busca o texto/autor de um comentário que mencionou a conta (a partir do webhook de menção). */
export async function getMentionedComment(accessToken: string, igUserId: string, commentId: string): Promise<MentionedComment> {
  const data = await igFetch<{ mentioned_comment: MentionedComment }>(
    `${igUserId}?fields=mentioned_comment.comment_id(${commentId}){id,text,username,timestamp,media}`,
    accessToken,
  )
  return data.mentioned_comment
}

export interface MentionedMedia {
  id: string
  caption?: string
  media_url?: string
  thumbnail_url?: string
  timestamp?: string
  username?: string
}

/** Busca os dados de uma publicação que mencionou a conta na legenda (a partir do webhook de menção). */
export async function getMentionedMedia(accessToken: string, igUserId: string, mediaId: string): Promise<MentionedMedia> {
  const data = await igFetch<{ mentioned_media: MentionedMedia }>(
    `${igUserId}?fields=mentioned_media.media_id(${mediaId}){id,caption,media_url,thumbnail_url,timestamp,username}`,
    accessToken,
  )
  return data.mentioned_media
}

/* ─── Insights (métricas) ───────────────────────────────────────────────── */

export interface InstagramInsightBreakdownResult {
  dimension_values?: string[]
  value?: number
}

export interface InstagramInsightValue {
  name: string
  period: string
  values?: Array<{ value: number; end_time?: string }>
  total_value?: { value: number; breakdowns?: Array<{ dimension_keys?: string[]; results?: InstagramInsightBreakdownResult[] }> }
  title?: string
}

/**
 * Métricas de conta (ex: reach, accounts_engaged, likes) via metric_type=total_value.
 * IMPORTANTE: pra esse metric_type a Graph API só aceita period=day — "week"/"days_28" NÃO são períodos
 * válidos aqui (isso é só pra metric_type=time_series). Pra agregar 7/28 dias, o jeito certo é mandar
 * period=day + since/until (timestamps unix) cobrindo a janela desejada; a API devolve um total_value
 * único já somando o intervalo inteiro — não precisa somar manualmente.
 * ver https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/insights
 */
export async function getAccountInsights(
  accessToken: string,
  igUserId: string,
  metrics: string[],
  options: { metricType?: 'total_value'; since?: number; until?: number; breakdown?: string } = {},
): Promise<InstagramInsightValue[]> {
  const params = new URLSearchParams({ metric: metrics.join(','), period: 'day' })
  if (options.metricType) params.set('metric_type', options.metricType)
  if (options.since !== undefined) params.set('since', String(options.since))
  if (options.until !== undefined) params.set('until', String(options.until))
  if (options.breakdown) params.set('breakdown', options.breakdown)

  const data = await igFetch<{ data: InstagramInsightValue[] }>(`${igUserId}/insights?${params.toString()}`, accessToken)
  return data.data ?? []
}

/** Seguidores, quem a conta segue e total de publicações — campos do próprio objeto da conta (não é insight). */
export async function getAccountTotals(
  accessToken: string,
  igUserId: string,
): Promise<{ followers_count?: number; follows_count?: number; media_count?: number }> {
  return igFetch(`${igUserId}?fields=followers_count,follows_count,media_count`, accessToken)
}

export interface FollowerGrowth {
  net: number
  follows?: number
  unfollows?: number
}

/**
 * Crescimento de seguidores num intervalo. O metric "follower_count" não existe mais na Graph API atual
 * (não aparece na referência de métricas de ig-user) — o substituto documentado é "follows_and_unfollows"
 * com breakdown=follow_type. A Meta não publica um exemplo de JSON pra essa métrica específica, então a
 * leitura do breakdown abaixo é defensiva: procura por dimensões que contenham "UNFOLLOW" vs "FOLLOW" em
 * vez de comparar contra um enum fixo, e cai pra total_value.value (sem separar follows/unfollows) se o
 * formato vier diferente do esperado.
 */
export async function getFollowerGrowth(
  accessToken: string,
  igUserId: string,
  sinceUnix: number,
  untilUnix: number,
): Promise<FollowerGrowth> {
  const insights = await getAccountInsights(accessToken, igUserId, ['follows_and_unfollows'], {
    metricType: 'total_value',
    since: sinceUnix,
    until: untilUnix,
    breakdown: 'follow_type',
  })

  const totalValue = insights[0]?.total_value
  const results = totalValue?.breakdowns?.[0]?.results ?? []

  let follows: number | undefined
  let unfollows: number | undefined
  for (const r of results) {
    const key = (r.dimension_values?.[0] ?? '').toUpperCase()
    if (key.includes('UNFOLLOW')) unfollows = (unfollows ?? 0) + (r.value ?? 0)
    else if (key.includes('FOLLOW')) follows = (follows ?? 0) + (r.value ?? 0)
  }

  if (follows === undefined && unfollows === undefined) {
    console.error('[Instagram] follows_and_unfollows veio sem breakdown reconhecível:', JSON.stringify(insights))
  }

  const net = follows !== undefined || unfollows !== undefined ? (follows ?? 0) - (unfollows ?? 0) : (totalValue?.value ?? 0)
  return { net, follows, unfollows }
}

const CONTACT_BUTTON_LABELS: Record<string, string> = {
  BOOK_NOW: 'Agendamentos',
  CALL: 'Cliques para ligar',
  DIRECTION: 'Cliques em "Como chegar"',
  EMAIL: 'Contatos por e-mail',
  INSTANT_EXPERIENCE: 'Experiência instantânea',
  TEXT: 'Cliques para mensagem de texto',
  UNDEFINED: 'Outros toques de contato',
}

export interface ContactBreakdownItem {
  type: string
  label: string
  value: number
}

/**
 * Toques nos botões de contato do perfil (ligar, e-mail, como chegar etc). Substituiu os metrics
 * separados "email_contacts"/"get_directions_clicks"/"phone_call_clicks"/"text_message_clicks", que não
 * existem mais como top-level metrics — hoje é tudo "profile_links_taps" com breakdown=contact_button_type.
 */
export async function getContactButtonBreakdown(
  accessToken: string,
  igUserId: string,
  sinceUnix: number,
  untilUnix: number,
): Promise<ContactBreakdownItem[]> {
  const insights = await getAccountInsights(accessToken, igUserId, ['profile_links_taps'], {
    metricType: 'total_value',
    since: sinceUnix,
    until: untilUnix,
    breakdown: 'contact_button_type',
  })

  const results = insights[0]?.total_value?.breakdowns?.[0]?.results ?? []
  return results
    .map((r) => {
      const type = (r.dimension_values?.[0] ?? 'UNDEFINED').toUpperCase()
      return { type, label: CONTACT_BUTTON_LABELS[type] ?? type, value: r.value ?? 0 }
    })
    .filter((item) => item.value > 0)
}
