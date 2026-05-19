import { createHmac } from 'crypto'
import { pusherServer } from '@/lib/pusher'

/* ─── GET: verificação do endpoint pelo Meta ─────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  // Fluxo padrão do Meta (query params)
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 })
  }

  // Fluxo alternativo via Bearer Token (testes diretos, ex: Postman)
  const authHeader = request.headers.get('Authorization') ?? ''
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (bearerToken && bearerToken === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response('OK', { status: 200 })
  }

  return new Response('Forbidden', { status: 403 })
}

/* ─── POST: recebimento de eventos ──────────────────────────────────────── */
export async function POST(request: Request) {
  const rawBody = await request.text()

  // Valida assinatura HMAC-SHA256 para garantir que veio do Meta
  const signature = request.headers.get('x-hub-signature-256') ?? ''
  const appSecret = process.env.META_APP_SECRET ?? ''

  if (appSecret) {
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
    if (signature !== expected) {
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload: WebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  if (payload.object !== 'whatsapp_business_account') {
    return new Response('OK', { status: 200 })
  }

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value

      // Mensagens recebidas
      for (const msg of value.messages ?? []) {
        console.log('[Webhook] Mensagem recebida:', {
          from: msg.from,
          type: msg.type,
          text: msg.text?.body,
          timestamp: msg.timestamp,
        })
        
        // Envia a mensagem imediatamente para o front-end via Pusher (realtime)
        // Canal: 'whatsapp-chat' | Evento: 'new-message'
        pusherServer.trigger('whatsapp-chat', 'new-message', {
          id: msg.id,
          from: msg.from,
          type: msg.type,
          text: msg.text?.body,
          timestamp: msg.timestamp,
          direction: 'inbound' // Marca que é mensagem recebida
        }).catch(err => console.error('[Pusher Error]', err))
      }

      // Status de mensagens enviadas
      for (const status of value.statuses ?? []) {
        console.log('[Webhook] Status:', {
          id: status.id,
          status: status.status,
          recipient_id: status.recipient_id,
        })
        // TODO: atualizar status no banco de dados
      }
    }
  }

  return new Response('OK', { status: 200 })
}

/* ─── Tipos ──────────────────────────────────────────────────────────────── */
interface WebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        metadata: { display_phone_number: string; phone_number_id: string }
        contacts?: Array<{ profile: { name: string }; wa_id: string }>
        messages?: Array<{
          from: string
          id: string
          timestamp: string
          type: string
          text?: { body: string }
        }>
        statuses?: Array<{
          id: string
          status: string
          timestamp: string
          recipient_id: string
        }>
      }
      field: string
    }>
  }>
}
