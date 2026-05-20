const GRAPH_API = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION ?? 'v21.0'}`

/** Troca o code retornado pelo Embedded Signup por um business token. */
export async function exchangeCodeForToken(code: string): Promise<{ access_token: string; token_type: string }> {
  const url = new URL('https://graph.facebook.com/oauth/access_token')
  url.searchParams.set('client_id', process.env.NEXT_PUBLIC_META_APP_ID!)
  url.searchParams.set('client_secret', process.env.META_APP_SECRET!)
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
    throw new Error(err?.error?.message ?? 'Falha ao enviar mensagem')
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
