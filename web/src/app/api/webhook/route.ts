import { createHmac } from 'crypto'
import { after } from 'next/server'
import { criarMensagem, obterMetaAccessPorWabaId, atualizarStatusMensagem } from '@/lib/firestore'
import { processarMensagemComIA } from '@/lib/aiAgent'
import { Mensagem } from '@/types/database'

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
    // Buscar conta pelo WABA ID (vem no entry.id, não no metadata)
    const wabaId = entry.id  // ✅ WABA ID correto

    console.log('[Webhook] Buscando conta para WABA:', wabaId)

    // Se essa busca falhar (ex: env var de criptografia ausente/errada em
    // produção), não pode derrubar o webhook inteiro com 500 — a Meta trata
    // isso como falha de entrega e, depois de falhas repetidas, desativa o
    // webhook. Loga o erro e segue tratando como "conta não encontrada".
    let contaId: string | undefined
    try {
      const result = await obterMetaAccessPorWabaId(wabaId)
      contaId = result?.contaId
    } catch (error) {
      console.error('❌ Erro ao buscar conta pelo WABA (verifique env vars, ex: CREDENTIALS_ENCRYPTION_KEY):', error)
    }

    if (!contaId) {
      console.warn('⚠️ WABA não encontrado:', wabaId)
    } else {
      console.log('✅ Conta encontrada:', contaId)
    }
    
    for (const change of entry.changes ?? []) {
      const value = change.value

      // Mensagens recebidas
      for (const msg of value.messages ?? []) {
        // Sem conteúdo da mensagem nem telefone do cliente no log — só o
        // necessário pra depurar entrega, o resto é dado sensível do cliente.
        console.log('[Webhook] Mensagem recebida:', { type: msg.type, contaId })

        // Nome cadastrado pelo próprio contato no WhatsApp — vem junto no
        // payload (value.contacts), casado pelo wa_id com o remetente da
        // mensagem. Nem toda mensagem traz esse array (ex: alguns eventos de
        // status), então fica opcional.
        const nomeContato = value.contacts?.find((c) => c.wa_id === msg.from)?.profile?.name

        // Salva no Firebase (persistência — também é a fonte do polling do painel)
        if (contaId) {
          try {
            await criarMensagem({
              id: msg.id,
              contaId,
              from: msg.from,
              // Spread condicional: o Admin SDK do Firestore rejeita
              // "undefined" como valor de campo (viraria erro no .set()).
              ...(nomeContato ? { nomeContato } : {}),
              text: msg.text?.body ?? '(mídia)',
              timestamp: parseInt(msg.timestamp),
              tipo: 'recebida',
            })

            // Aciona o agente de IA (se ligado pra essa conta) DEPOIS de
            // responder 200 OK pro Meta — o Meta não pode esperar o Gemini
            // terminar, ou trata o webhook como falho.
            if (msg.text?.body) {
              const contaIdParaIA = contaId
              const from = msg.from
              after(() => processarMensagemComIA(contaIdParaIA, from))
            }
          } catch (error) {
            console.error('❌ Erro ao salvar mensagem no Firebase:', error)
          }
        } else {
          console.error('❌ Não foi possível salvar - contaId não encontrado para WABA (sistema legado):', wabaId)
          // Pode ser uma empresa do CRM novo (backend/app) — repassa pra lá.
          // Não bloqueia nem atrasa o "OK" pro Meta: roda depois da resposta,
          // e qualquer erro é só logado (ver encaminharParaBackendNovo).
          if (msg.text?.body) {
            after(() =>
              encaminharParaBackendNovo({
                wabaId,
                from: msg.from,
                messageId: msg.id,
                text: msg.text!.body,
                timestamp: parseInt(msg.timestamp),
                contactName: nomeContato,
              })
            )
          }
        }
      }

      // Status de mensagens enviadas
      for (const status of value.statuses ?? []) {
        console.log('[Webhook] Status:', { id: status.id, status: status.status })
        
        // Atualiza status no Firebase
        try {
          await atualizarStatusMensagem(status.id, status.status as Mensagem['status'])
        } catch (error) {
          console.error('❌ Erro ao atualizar status no Firebase:', error)
        }
      }
    }
  }

  return new Response('OK', { status: 200 })
}

/**
 * Encaminha uma mensagem recebida pro backend novo (backend/app, FastAPI) —
 * usado quando o WABA não é de nenhuma conta do sistema legado, ou seja, é
 * provavelmente uma empresa cadastrada no CRM novo (aba "Meta" + aba "IA").
 * Mesmo par de segredo já usado pelas rotas de /api/empresas
 * (BACKEND_ADMIN_KEY <-> PLATFORM_ADMIN_API_KEY do backend) — nenhuma
 * variável de ambiente nova.
 */
async function encaminharParaBackendNovo(params: {
  wabaId: string
  from: string
  messageId: string
  text: string
  timestamp: number
  contactName?: string
}): Promise<void> {
  const baseUrl = process.env.BACKEND_API_URL
  const adminKey = process.env.BACKEND_ADMIN_KEY
  if (!baseUrl || !adminKey) return

  try {
    const res = await fetch(`${baseUrl}/whatsapp/inbound-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Platform-Admin-Key': adminKey },
      body: JSON.stringify({
        waba_id: params.wabaId,
        from: params.from,
        message_id: params.messageId,
        text: params.text,
        timestamp: params.timestamp,
        contact_name: params.contactName,
      }),
    })
    if (!res.ok && res.status !== 404) {
      console.error('❌ Backend novo recusou a mensagem encaminhada:', res.status, await res.text())
    }
  } catch (error) {
    console.error('❌ Erro ao encaminhar mensagem pro backend novo:', error)
  }
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
