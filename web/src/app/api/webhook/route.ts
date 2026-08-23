import { createHmac } from 'crypto'
import { after } from 'next/server'
import { criarMensagem, obterMetaAccessPorWabaId, atualizarStatusMensagem, atualizarMetaAccess, obterInstagramAccessPorIgUserId, criarMensagemInstagram, criarComentarioInstagram, criarMencaoInstagram, garantirConversaAberta, definirCanalConversa } from '@/lib/firestore'
import { processarMensagemComIA } from '@/lib/aiAgent'
import { getMentionedComment, getMentionedMedia } from '@/lib/instagram'
import { processarMensagemComFluxo } from '@/lib/fluxoService'
import { aplicarPrioridadeAutomatica } from '@/lib/prioridadeConversa'
import { processarRespostaCsatSeAguardando } from '@/lib/csatService'

type TipoMidiaRecebida = 'image' | 'audio' | 'video' | 'document' | 'sticker'

const RETULOS_MIDIA_PADRAO: Record<TipoMidiaRecebida, string> = {
  image: '📷 Imagem',
  audio: '🎤 Áudio',
  video: '🎥 Vídeo',
  document: '📎 Documento',
  sticker: '🩹 Figurinha',
}

/** Extrai o id/legenda da mídia de uma mensagem recebida (mensagens de texto não têm nenhum desses campos). */
function extrairMidiaDoWebhook(msg: WebhookMessage): { tipo: TipoMidiaRecebida; mediaId: string; filename?: string; caption?: string } | null {
  if (msg.image) return { tipo: 'image', mediaId: msg.image.id, caption: msg.image.caption }
  if (msg.video) return { tipo: 'video', mediaId: msg.video.id, caption: msg.video.caption }
  if (msg.document) return { tipo: 'document', mediaId: msg.document.id, filename: msg.document.filename, caption: msg.document.caption }
  if (msg.audio) return { tipo: 'audio', mediaId: msg.audio.id }
  if (msg.sticker) return { tipo: 'sticker', mediaId: msg.sticker.id }
  return null
}

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

  // Instagram (DMs e comentários) — mesmo padrão de sempre responder 200 OK
  // mesmo se o processamento falhar, pra Meta não desativar o webhook.
  if (raw.object === 'instagram') {
    after(() => processarWebhookInstagram(raw as InstagramWebhookPayload))
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

        // Resposta a um botão/lista nativos (enviados pelo fluxo de
        // atendimento) chega como type "interactive", não "text" — trata o
        // título escolhido como se fosse o texto digitado, pra casar com o
        // rótulo da opção no motor do fluxo (fluxoEngine) sem mudar nada lá.
        const textoInterativo = msg.interactive?.button_reply?.title ?? msg.interactive?.list_reply?.title

        // Resposta a um nó "Solicitar localização" do fluxo — vira um link
        // do Google Maps, tanto pro histórico da conversa quanto pro valor
        // guardado em Conversa.dadosColetados (ver continuarFluxo/coleta).
        const textoLocalizacao = msg.location
          ? `📍 ${msg.location.name ? `${msg.location.name} — ` : ''}https://www.google.com/maps?q=${msg.location.latitude},${msg.location.longitude}`
          : undefined

        // Foto, áudio, vídeo, documento ou figurinha — não baixa nem
        // hospeda nada aqui (sem Firebase Storage, que exige plano pago); só
        // guarda o ID da mídia, que continua hospedada na própria Meta. O
        // painel busca os bytes sob demanda via /api/whatsapp/midia/[mediaId].
        const midia = extrairMidiaDoWebhook(msg)

        const corpoTexto = msg.text?.body ?? textoInterativo ?? textoLocalizacao ?? midia?.caption ?? (midia ? RETULOS_MIDIA_PADRAO[midia.tipo] : undefined)

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
              text: corpoTexto ?? '(mídia)',
              timestamp: parseInt(msg.timestamp),
              tipo: 'recebida',
              ...(midia ? { mediaType: midia.tipo, mediaId: midia.mediaId } : {}),
              ...(midia?.filename ? { mediaFilename: midia.filename } : {}),
            })

            // Cria a conversa (status 'aberta') se for a primeira mensagem
            // desse número, ou reabre se estava 'encerrada' — mensagem nova
            // sempre reativa a conversa na fila do painel.
            await garantirConversaAberta(contaId, msg.from)

            // Guarda por qual número da conta (principal ou adicional) esse
            // cliente está falando — toda resposta futura sai por ele, não
            // sempre pelo principal (contas com mais de um número).
            if (value.metadata?.phone_number_id) {
              await definirCanalConversa(contaId, msg.from, value.metadata.phone_number_id).catch(() => {})
            }

            // Cliente cadastrado com tag VIP/prioritário fura a fila —
            // best-effort, nunca deve atrasar/derrubar o resto do webhook.
            await aplicarPrioridadeAutomatica(contaId, msg.from).catch((error) => {
              console.error('Erro ao aplicar prioridade automática:', error)
            })

            // Aciona o fluxo de atendimento (se a conta tiver um configurado
            // e ligado) e, se ele não tratar a mensagem — sem fluxo, ou o
            // fluxo decidiu encaminhar pra IA —, cai no agente de IA de
            // sempre. Tudo DEPOIS de responder 200 OK pro Meta, que não pode
            // esperar isso terminar ou trata o webhook como falho.
            if (corpoTexto) {
              const contaIdParaIA = contaId
              const from = msg.from
              const texto = corpoTexto
              after(async () => {
                // Se a conversa tinha acabado de ser encerrada e essa é a
                // resposta à pergunta de satisfação, essa mensagem NÃO é uma
                // nova conversa — nem o fluxo nem a IA devem vê-la.
                const tratadoPeloCsat = await processarRespostaCsatSeAguardando(contaIdParaIA, from, texto).catch((error) => {
                  console.error('Erro ao processar resposta de satisfação (CSAT):', error)
                  return false
                })
                if (tratadoPeloCsat) return

                const tratadoPeloFluxo = await processarMensagemComFluxo(contaIdParaIA, from, texto).catch((error) => {
                  console.error('Erro ao processar mensagem pelo fluxo de atendimento:', error)
                  return false
                })
                if (!tratadoPeloFluxo) await processarMensagemComIA(contaIdParaIA, from)
              })
            }
          } catch (error) {
            console.error('❌ Erro ao salvar mensagem no Firebase:', error)
          }
        } else {
          console.error('❌ Não foi possível salvar - contaId não encontrado para WABA (sistema legado):', wabaId)
          // Pode ser uma empresa do CRM novo (backend/app) — repassa pra lá.
          // Não bloqueia nem atrasa o "OK" pro Meta: roda depois da resposta,
          // e qualquer erro é só logado (ver encaminharParaBackendNovo).
          if (corpoTexto) {
            after(() =>
              encaminharParaBackendNovo({
                wabaId,
                from: msg.from,
                messageId: msg.id,
                text: corpoTexto,
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
 * Processa os eventos de um webhook do Instagram: DMs (`entry.messaging`) e
 * comentários (`entry.changes` com `field === 'comments'`). Roda depois da
 * resposta 200 OK (via `after()`, chamado no POST acima) — mesmo motivo do
 * WhatsApp: a Meta não pode esperar o processamento pra considerar o webhook entregue.
 */
async function processarWebhookInstagram(payload: InstagramWebhookPayload) {
  for (const entry of payload.entry ?? []) {
    const igUserId = entry.id
    let contaId: string | undefined
    let accessToken: string | undefined
    try {
      const result = await obterInstagramAccessPorIgUserId(igUserId)
      contaId = result?.contaId
      accessToken = result?.instagramAccess.accessToken
    } catch (error) {
      console.error('❌ Erro ao buscar conta pelo igUserId:', error)
    }

    if (!contaId) {
      console.warn('⚠️ Instagram: igUserId não encontrado em nenhuma conta:', igUserId)
      continue
    }

    for (const evento of entry.messaging ?? []) {
      if (!evento.message?.text || !evento.message.mid) continue
      // Eco da própria mensagem enviada pelo painel/Meta — já foi persistida
      // na hora do envio (ver POST /api/instagram/messages), evita duplicar.
      if (evento.message.is_echo) continue

      try {
        await criarMensagemInstagram({
          id: evento.message.mid,
          contaId,
          conversationId: evento.sender.id,
          from: evento.sender.id,
          to: evento.recipient?.id,
          text: evento.message.text,
          timestamp: evento.timestamp ? Math.floor(evento.timestamp / 1000) : Math.floor(Date.now() / 1000),
          tipo: 'recebida',
        })
      } catch (error) {
        console.error('❌ Erro ao salvar DM do Instagram no Firebase:', error)
      }
    }

    for (const change of entry.changes ?? []) {
      if (change.field === 'comments' && change.value) {
        const comentario = change.value
        try {
          await criarComentarioInstagram({
            id: comentario.id,
            contaId,
            mediaId: comentario.media?.id ?? '',
            from: comentario.from?.username ?? comentario.from?.id ?? 'desconhecido',
            fromId: comentario.from?.id,
            text: comentario.text ?? '',
            timestamp: Math.floor(Date.now() / 1000),
          })
        } catch (error) {
          console.error('❌ Erro ao salvar comentário do Instagram no Firebase:', error)
        }
        continue
      }

      // Menção (@conta) num comentário ou na legenda de uma publicação de terceiros — a Graph
      // API só avisa por webhook (sem endpoint pra buscar menções antigas), então é preciso
      // buscar o detalhe (texto/mídia) na hora, usando o ID que o webhook informou.
      if (change.field === 'mentions' && change.value && accessToken) {
        const mencao = change.value
        try {
          if (mencao.comment_id) {
            const comentario = await getMentionedComment(accessToken, igUserId, mencao.comment_id)
            await criarMencaoInstagram({
              id: comentario.id,
              contaId,
              tipo: 'comentario',
              mediaId: comentario.media?.id,
              text: comentario.text,
              username: comentario.username,
              timestamp: comentario.timestamp ? Math.floor(new Date(comentario.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
            })
          } else if (mencao.media_id) {
            const media = await getMentionedMedia(accessToken, igUserId, mencao.media_id)
            await criarMencaoInstagram({
              id: media.id,
              contaId,
              tipo: 'legenda',
              mediaId: media.id,
              text: media.caption,
              username: media.username,
              timestamp: media.timestamp ? Math.floor(new Date(media.timestamp).getTime() / 1000) : Math.floor(Date.now() / 1000),
            })
          }
        } catch (error) {
          console.error('❌ Erro ao processar menção do Instagram:', error)
        }
      }
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

// Estrutura ainda não confirmada contra um payload real em produção (só
// testada localmente) — revisar contra os logs quando a primeira conta de
// cliente de verdade começar a receber DMs/comentários.
interface InstagramWebhookPayload {
  object: 'instagram'
  entry?: Array<{
    id: string
    time?: number
    messaging?: Array<{
      sender: { id: string }
      recipient?: { id: string }
      timestamp?: number
      message?: { mid: string; text?: string; is_echo?: boolean }
    }>
    changes?: Array<{
      field: string
      value?: {
        id: string
        text?: string
        from?: { id: string; username?: string }
        media?: { id: string }
        // Presentes só em eventos field === 'mentions' — o comentário ou a mídia que mencionou a conta.
        comment_id?: string
        media_id?: string
      }
    }>
  }>
}

// Uma mensagem recebida — id/mime_type presentes em qualquer tipo de mídia;
// `caption` só em image/video/document, `filename` só em document.
interface WebhookMediaField {
  id: string
  mime_type?: string
  sha256?: string
  caption?: string
  filename?: string
}

interface WebhookMessage {
  from: string
  id: string
  timestamp: string
  type: string
  text?: { body: string }
  // Resposta a um botão/lista nativos (mensagens type "interactive").
  interactive?: {
    type: 'button_reply' | 'list_reply'
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string; description?: string }
  }
  image?: WebhookMediaField
  video?: WebhookMediaField
  audio?: WebhookMediaField
  document?: WebhookMediaField
  sticker?: WebhookMediaField
  // Resposta a um nó "Solicitar localização" do fluxo.
  location?: { latitude: number; longitude: number; name?: string; address?: string }
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
        messages?: WebhookMessage[]
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
