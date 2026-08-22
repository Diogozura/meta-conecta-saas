import { obterMetaAccess } from './firestore'
import { auth } from './auth'

const GRAPH_API = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION ?? 'v21.0'}`

/**
 * Busca as credenciais da Meta armazenadas no Firebase para a conta do usuário logado
 */
export async function getMetaCredentials() {
  const session = await auth()
  if (!session?.user?.contaId) {
    throw new Error('Usuário não autenticado')
  }

  const metaAccess = await obterMetaAccess(session.user.contaId)
  if (!metaAccess) {
    throw new Error('Credenciais da Meta não configuradas. Acesse Configurações para adicionar.')
  }

  return {
    wabaId: metaAccess.wabaId,
    phoneNumberId: metaAccess.phoneNumberId,
    businessToken: metaAccess.businessToken,
    appId: metaAccess.appId,
    appSecret: metaAccess.appSecret,
    webhookVerifyToken: metaAccess.webhookVerifyToken,
    numerosAdicionais: metaAccess.numerosAdicionais,
  }
}

/** Troca o code retornado pelo Embedded Signup por um business token. */
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
  const credentials = await getMetaCredentials()
  
  const url = new URL('https://graph.facebook.com/oauth/access_token')
  url.searchParams.set('client_id', credentials.appId)
  url.searchParams.set('client_secret', credentials.appSecret)
  url.searchParams.set('code', code)

  const res = await fetch(url.toString())
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao trocar token')
  }
  return res.json()
}

/** Registra o número de telefone para uso com a Cloud API. */
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string, pin = '000000') {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao registrar telefone')
  }
  return res.json()
}

/**
 * Dispara a sincronização de dados do app WhatsApp Business (modo
 * Coexistence) — contatos (`smb_app_state_sync`) ou histórico de mensagens
 * (`history`). É assíncrono: o resultado chega depois via webhook, essa
 * chamada só inicia o processo (a Meta responde com um `request_id`).
 */
export async function syncSmbAppData(
  phoneNumberId: string,
  accessToken: string,
  syncType: 'smb_app_state_sync' | 'history',
): Promise<{ request_id?: string }> {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/smb_app_data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ messaging_product: 'whatsapp', sync_type: syncType }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? `Falha ao sincronizar (${syncType})`)
  }
  return res.json()
}

/** Inscreve o app nos webhooks de um WABA. */
export async function subscribeToWebhooks(wabaId: string, accessToken: string) {
  const res = await fetch(`${GRAPH_API}/${wabaId}/subscribed_apps`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao assinar webhooks')
  }
  return res.json()
}

/** Erro retornado pela Graph API — preserva o `code` do erro (ex: 131047
 * quando a janela de 24h de atendimento expirou) pra quem chamou decidir
 * como tratar cada caso. */
export class MetaApiError extends Error {
  code?: number
  constructor(message: string, code?: number) {
    super(message)
    this.name = 'MetaApiError'
    this.code = code
  }
}

/** Envia uma mensagem de texto simples via Cloud API. */
export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body: text, preview_url: false },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new MetaApiError(err?.error?.message ?? 'Falha ao enviar mensagem', err?.error?.code)
  }
  return res.json()
}

export interface InteractiveButton { id: string; title: string }

/** Envia mensagem com até 3 botões de resposta rápida nativos do WhatsApp (limite da Cloud API: 3 botões, título de até 20 caracteres). */
export async function sendButtonsMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: InteractiveButton[],
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title } })) },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new MetaApiError(err?.error?.message ?? 'Falha ao enviar mensagem com botões', err?.error?.code)
  }
  return res.json()
}

export interface InteractiveListRow { id: string; title: string; description?: string }

/** Envia mensagem com lista de opções nativa do WhatsApp (limite da Cloud API: 10 linhas, título de até 24 caracteres). */
export async function sendListMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttonLabel: string,
  rows: InteractiveListRow[],
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: bodyText },
        action: {
          button: buttonLabel,
          sections: [{ rows: rows.map((r) => ({ id: r.id, title: r.title, ...(r.description ? { description: r.description } : {}) })) }],
        },
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new MetaApiError(err?.error?.message ?? 'Falha ao enviar mensagem com lista', err?.error?.code)
  }
  return res.json()
}

export interface MediaInfo {
  url: string
  mimeType: string
  sha256?: string
  fileSize?: number
}

/** Busca a URL temporária (expira em poucos minutos) de um arquivo de mídia recebido — a URL em si também exige o Bearer token pra baixar (ver downloadMedia). */
export async function getMediaInfo(mediaId: string, accessToken: string): Promise<MediaInfo> {
  const res = await fetch(`${GRAPH_API}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new MetaApiError(err?.error?.message ?? 'Falha ao buscar informações da mídia', err?.error?.code)
  }
  const json = await res.json()
  return { url: json.url, mimeType: json.mime_type, sha256: json.sha256, fileSize: json.file_size }
}

/** Baixa os bytes de uma mídia recebida — a URL temporária da Meta exige o mesmo Bearer token do WABA, não é pública. */
export async function downloadMedia(url: string, accessToken: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    throw new MetaApiError('Falha ao baixar o arquivo de mídia')
  }
  const arrayBuffer = await res.arrayBuffer()
  return { buffer: Buffer.from(arrayBuffer), mimeType: res.headers.get('content-type') ?? 'application/octet-stream' }
}

export type TipoMidiaEnvio = 'image' | 'audio' | 'video' | 'document'

/** Envia mídia por URL pública (a mesma cópia que sobe pro Firebase Storage antes de chamar essa função — a Cloud API não aceita upload direto de arquivo nesse fluxo). */
export async function sendMediaMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  tipo: TipoMidiaEnvio,
  link: string,
  opts: { caption?: string; filename?: string } = {},
) {
  const conteudo: Record<string, unknown> = { link }
  if (opts.caption && tipo !== 'audio') conteudo.caption = opts.caption
  if (opts.filename && tipo === 'document') conteudo.filename = opts.filename

  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: tipo,
      [tipo]: conteudo,
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new MetaApiError(err?.error?.message ?? 'Falha ao enviar mídia', err?.error?.code)
  }
  return res.json()
}

/** Envia uma mensagem usando um template aprovado. */
export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode = 'pt_BR',
  components: object[] = [],
) {
  const res = await fetch(`${GRAPH_API}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: { name: templateName, language: { code: languageCode }, components },
    }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao enviar template')
  }
  return res.json()
}

export type TemplateCategory = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'

export interface TemplateComponent {
  type: 'HEADER' | 'BODY' | 'FOOTER'
  format?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'DOCUMENT'
  text?: string
}

export interface MetaTemplate {
  id: string
  name: string
  status: string
  category: TemplateCategory
  language: string
  components: TemplateComponent[]
}

/** Cria um template de mensagem no WABA. */
export async function createTemplate(
  wabaId: string,
  accessToken: string,
  payload: {
    name: string
    category: TemplateCategory
    language: string
    components: TemplateComponent[]
  },
): Promise<{ id: string; status: string }> {
  const res = await fetch(`${GRAPH_API}/${wabaId}/message_templates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao criar template')
  }
  return res.json()
}

/** Lista os templates existentes no WABA. */
export async function listTemplates(
  wabaId: string,
  accessToken: string,
): Promise<MetaTemplate[]> {
  const url = new URL(`${GRAPH_API}/${wabaId}/message_templates`)
  url.searchParams.set('fields', 'id,name,status,category,language,components')
  url.searchParams.set('limit', '50')

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err?.error?.message ?? 'Falha ao listar templates')
  }
  const json = await res.json()
  return json.data ?? []
}
