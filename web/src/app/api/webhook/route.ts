import { createHmac } from 'crypto'
import { after } from 'next/server'
import { criarMensagem, obterMetaAccessPorWabaId, atualizarStatusMensagem, atualizarMetaAccess, obterInstagramAccessPorIgUserId } from '@/lib/firestore'
import { processarMensagemComIA } from '@/lib/aiAgent'

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

  if (!appSecret) {
    console.error('❌ META_APP_SECRET não configurado — recusando webhook (fail-closed).')
    return new Response('Server Misconfigured', { status: 500 })
  }

  const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex')
  if (signature !== expected) {
    return new Response('Unauthorized', { status: 401 })
  }

  let raw: { object?: string }
  try {
    raw = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // Instagram (mensagens/comentários) — infraestrutura só, ainda não
  // processa: as telas de mensagens/comentários do Instagram no Zybot ainda
  // não existem, então por enquanto só loga e reconhece o recebimento (fail
  // silencioso e seguro em vez de derrubar o webhook por engano).
  if (raw.object === 'instagram') {
    after(() => logWebhookInstagram(raw as InstagramWebhookPayload))
    return new Response('OK', { status: 200 })
  }

  if (raw.object !== 'whatsapp_business_account') {
    return new Response('OK', { status: 200 })
  }

  const payload = raw as WebhookPayload

  for (const entry of payload.entry ?? []) {
    // Buscar conta pelo WABA ID (vem no entry.id, não no metadata)
    const wabaId = entry.id  // ✅ WABA ID correto

    console.log('[Webhook] Buscando conta para WABA:', wabaId)

    // Se essa busca falhar (ex: env var de criptografia ausente/errada em
    // produção), não pode derrubar o webhook inteiro com 500 — a Meta trata
    // isso como falha de entrega e, depois de falhas repetidas, desativa o
    // webhook. Loga o erro e segue tratando como "conta não encontrada".
    let contaId: string | undefined
    let metaAccessId: string | undefined
    try {
      const result = await obterMetaAccessPorWabaId(wabaId)
      contaId = result?.contaId
      metaAccessId = result?.metaAccess.id
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

      // Conta desconectada direto pelo celular (modo Coexistence) — o dono
      // removeu a integração pelo app, então marca como desconectada em vez
      // de deixar o painel achando que ainda está tudo certo.
      if (value.event === 'PARTNER_REMOVED') {
        console.warn('[Webhook] Conta desconectada pelo WhatsApp Business App (PARTNER_REMOVED):', {
          contaId,
          disconnection_info: value.disconnection_info,
        })
        if (contaId && metaAccessId) {
          try {
            await atualizarMetaAccess(contaId, metaAccessId, { desconectadoEm: new Date() })
          } catch (error) {
            console.error('❌ Erro ao marcar conta como desconectada:', error)
          }
        }
      }

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

        // Quando falha (ex: janela de 24h expirada), a Meta manda o motivo
        // aqui — não na resposta síncrona do envio.
        const primeiroErro = status.errors?.[0]
        const erro = status.status === 'failed' && primeiroErro
          ? { codigo: primeiroErro.code, mensagem: primeiroErro.title ?? primeiroErro.message ?? 'Falha ao entregar a mensagem' }
          : undefined

        // Atualiza status no Firebase
        try {
          await atualizarStatusMensagem(status.id, status.status, erro)
        } catch (error) {
          console.error('❌ Erro ao atualizar status no Firebase:', error)
        }
      }

      // Histórico de mensagens sincronizado (modo Coexistence — número
      // também em uso no app do celular). Só grava; não aciona o agente de
      // IA nem encaminha pro backend novo, porque são mensagens antigas, não
      // uma pergunta nova esperando resposta.
      for (const chunk of value.history ?? []) {
        if (chunk.errors?.length) {
          console.warn('[Webhook] Erro na sincronização de histórico:', chunk.errors)
          continue
        }
        if (!contaId) continue

        const numeroProprio = value.metadata?.display_phone_number?.replace(/\D/g, '')
        const phoneNumberId = value.metadata?.phone_number_id

        for (const thread of chunk.threads ?? []) {
          for (const msg of thread.messages ?? []) {
            const deSaida = !!numeroProprio && msg.from.replace(/\D/g, '') === numeroProprio
            const numeroCliente = deSaida ? (msg.to ?? thread.id) : msg.from

            try {
              await criarMensagem({
                id: msg.id,
                contaId,
                from: deSaida ? (phoneNumberId ?? numeroCliente) : numeroCliente,
                ...(deSaida ? { to: numeroCliente } : {}),
                text: msg.text?.body ?? '(mídia)',
                timestamp: parseInt(msg.timestamp),
                tipo: deSaida ? 'enviada' : 'recebida',
                historico: true,
              })
            } catch (error) {
              console.error('❌ Erro ao salvar mensagem de histórico no Firebase:', error)
            }
          }
        }
      }

      // Mensagens enviadas direto pelo app do celular ou um dispositivo
      // vinculado (modo Coexistence) — espelha no painel do Zybot pra manter
      // a conversa completa dos dois lados, do mesmo jeito que uma mensagem
      // enviada pelo próprio painel.
      for (const echo of value.message_echoes ?? []) {
        if (!contaId) continue

        // Edição/revogação de mensagem já enviada — não tem um equivalente
        // direto no formato atual de mensagem (que não versiona edições).
        // Loga por enquanto; tratar isso é um passo separado.
        if (echo.type === 'revoke' || echo.type === 'edit') {
          console.log('[Webhook] Echo de edição/revogação recebido (ainda não tratado):', { contaId, type: echo.type, id: echo.id })
          continue
        }

        try {
          await criarMensagem({
            id: echo.id,
            contaId,
            from: value.metadata?.phone_number_id ?? echo.from,
            to: echo.to,
            text: echo.text?.body ?? '(mídia)',
            timestamp: parseInt(echo.timestamp),
            tipo: 'enviada',
          })
        } catch (error) {
          console.error('❌ Erro ao salvar mensagem espelhada (app do celular) no Firebase:', error)
        }
      }
    }
  }

  return new Response('OK', { status: 200 })
}

/**
 * Loga a estrutura de um webhook do Instagram — placeholder até as telas de
 * mensagens/comentários existirem no Zybot. Também tenta identificar a conta
 * (via `obterInstagramAccessPorIgUserId`) só pra confirmar que o vínculo
 * conta ↔ igUserId está funcionando antes de depender disso de verdade.
 */
async function logWebhookInstagram(payload: InstagramWebhookPayload) {
  for (const entry of payload.entry ?? []) {
    const campos = entry.changes?.map((c) => c.field) ?? (entry.messaging ? ['messaging'] : [])
    console.log('[Webhook] Instagram — evento recebido:', { igUserId: entry.id, campos })

    try {
      const result = await obterInstagramAccessPorIgUserId(entry.id)
      if (!result) {
        console.warn('⚠️ Instagram: igUserId não encontrado em nenhuma conta:', entry.id)
      }
    } catch (error) {
      console.error('❌ Erro ao buscar conta pelo igUserId:', error)
    }
  }
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

// Estrutura ainda não confirmada contra payload real (nenhuma conta conectada
// até agora) — só o suficiente pra logar sem quebrar. Revisitar quando as
// mensagens/comentários do Instagram forem implementados de verdade.
interface InstagramWebhookPayload {
  object: 'instagram'
  entry?: Array<{
    id: string
    changes?: Array<{ field: string }>
    messaging?: unknown[]
  }>
}

interface WebhookPayload {
  object: string
  entry: Array<{
    id: string
    changes: Array<{
      value: {
        messaging_product: string
        // Ausente em alguns eventos de conta (ex: account_update), por isso
        // opcional — nem toda notificação é sobre um número específico.
        metadata?: { display_phone_number: string; phone_number_id: string }
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
          errors?: Array<{ code: number; title?: string; message?: string }>
        }>
        // Sincronização de histórico (modo Coexistence) — chega em vários
        // "chunks", cada um com uma leva de threads/mensagens antigas.
        history?: Array<{
          metadata?: { phase?: string; chunk_order?: number; progress?: string }
          threads?: Array<{
            id: string
            messages?: Array<{
              from: string
              to?: string
              id: string
              timestamp: string
              type: string
              text?: { body: string }
            }>
          }>
          errors?: Array<{ code: number; title?: string; message?: string }>
        }>
        // Mensagens enviadas pelo app do celular ou um dispositivo vinculado
        // (modo Coexistence).
        message_echoes?: Array<{
          from: string
          to?: string
          id: string
          timestamp: string
          type: string
          text?: { body: string }
        }>
        // Eventos de conta (ex: account_update com PARTNER_REMOVED, quando o
        // dono desconecta a integração direto pelo celular).
        event?: string
        disconnection_info?: { reason?: string; initiated_by?: string }
      }
      field: string
    }>
  }>
}
