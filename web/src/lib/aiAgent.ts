import { obterConta, obterMetaAccess, listarMensagensPorNumero, criarMensagem, obterConversa, registrarErroAgenteIA, registrarUsoAgenteIA, marcarConversaEmAndamento } from '@/lib/firestore'
import { sendTextMessage, getMediaInfo, downloadMedia } from '@/lib/meta'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'
import { runGeminiAgent } from '@/lib/aiProviderGemini'
import { runOpenAIAgent } from '@/lib/aiProviderOpenAI'
import { runAnthropicAgent } from '@/lib/aiProviderAnthropic'
import { AgentRunParams, humanizarErroAgente } from '@/lib/aiAgentTypes'
import { contextoDataAtual } from '@/lib/aiAgentTools'

const MENSAGEM_FALLBACK_IA = 'Desculpe, tivemos um problema técnico ao processar sua mensagem. Tente novamente em alguns instantes — se preferir, um atendente humano também pode te ajudar.'

/**
 * Processa uma mensagem recebida no WhatsApp com o agente de IA: monta o
 * histórico da conversa, chama o provedor configurado (Gemini/OpenAI/Anthropic)
 * com as ferramentas da agenda em loop, e envia a resposta final de volta
 * pro cliente. Chamado em segundo plano pelo webhook (via `after()`) — não
 * deve travar a resposta ao Meta.
 */
export async function processarMensagemComIA(contaId: string, telefoneCliente: string): Promise<void> {
  const conta = await obterConta(contaId)
  if (!conta?.ai?.enabled) return

  if (!conta.ai.apiKey) {
    console.error('Agente de IA ativo mas sem chave de API configurada, contaId:', contaId)
    return
  }

  const metaAccess = await obterMetaAccess(contaId)
  if (!metaAccess) {
    console.error('Agente de IA ativo mas sem credenciais da Meta configuradas, contaId:', contaId)
    return
  }

  // Se a conversa já foi transferida pra um humano (ou o atendente respondeu
  // manualmente), a IA não volta a responder sozinha até alguém reativar.
  const conversa = await obterConversa(contaId, telefoneCliente)
  if (conversa && conversa.iaAtiva === false) return

  // Só manda o aviso de fallback ("tivemos um problema técnico") se a IA
  // realmente não conseguiu entregar NENHUMA resposta — evita mandar um
  // pedido de desculpas depois de uma resposta que já foi entregue com
  // sucesso (ex: erro só na hora de salvar o registro no Firestore).
  let respondeuComSucesso = false

  try {
    const mensagens = await listarMensagensPorNumero(contaId, telefoneCliente, 20)
    const ordenadas = [...mensagens].sort((a, b) => a.timestamp - b.timestamp)
    const ultima = ordenadas.pop()
    if (!ultima) return // nada pra responder

    // O contexto de data/hora é recalculado a cada mensagem (não pode ser
    // cacheado) — cada request pega o "agora" real no momento em que o
    // cliente escreveu, senão "amanhã" fica errado com o tempo.
    // Dados que o Fluxo de atendimento coletou antes de entregar essa
    // conversa pra IA (ex: CPF, protocolo) — evita pedir de novo o que o
    // cliente já informou no menu.
    const dadosColetados = conversa?.dadosColetados
    const contextoColeta =
      dadosColetados && Object.keys(dadosColetados).length > 0
        ? `--- Dados já informados pelo cliente antes ---\n${Object.entries(dadosColetados)
            .map(([chave, valor]) => `${chave}: ${valor}`)
            .join('\n')}`
        : null

    const systemPrompt = [
      conta.ai.prompt,
      contextoDataAtual(),
      conta.ai.informacoesNegocio ? `--- Informações do negócio ---\n${conta.ai.informacoesNegocio}` : null,
      contextoColeta,
    ]
      .filter((parte): parte is string => !!parte)
      .join('\n\n')

    // Nota de voz: o Gemini entende áudio nativamente — busca os bytes na
    // Meta (a mensagem só guarda o mediaId) e manda pro modelo de verdade,
    // em vez do cliente ficar sem resposta útil pro que ele realmente
    // perguntou. Só faz sentido pro provedor Gemini; nos outros, a IA
    // continua vendo só o rótulo genérico ("🎤 Áudio") em `mensagemAtual`.
    let audioInline: AgentRunParams['audioInline']
    if (conta.ai.provider === 'gemini' && ultima.mediaType === 'audio' && ultima.mediaId) {
      try {
        const info = await getMediaInfo(ultima.mediaId, metaAccess.businessToken)
        const { buffer, mimeType } = await downloadMedia(info.url, metaAccess.businessToken)
        audioInline = { data: buffer.toString('base64'), mimeType }
      } catch (error) {
        console.error('Erro ao baixar áudio pra transcrição pela IA (segue sem o áudio):', error)
      }
    }

    const runParams: AgentRunParams = {
      contaId,
      telefoneCliente,
      systemPrompt,
      model: conta.ai.model,
      apiKey: conta.ai.apiKey,
      history: ordenadas.map((m) => ({ role: m.tipo === 'recebida' ? 'user' as const : 'model' as const, text: m.text })),
      mensagemAtual: audioInline ? 'O cliente mandou uma nota de voz — ouça o áudio anexado e responda ao que ele disse.' : ultima.text,
      audioInline,
    }

    const textoFinal = await executarProvedor(conta.ai.provider, runParams)
    // Conta a chamada ao provedor mesmo que o texto volte vazio — a cota já
    // foi consumida nesse momento, independente do envio pro WhatsApp adiante.
    await registrarUsoAgenteIA(contaId).catch(() => {})
    if (!textoFinal) return

    const phoneNumberId = resolverPhoneNumberId(metaAccess, conversa?.canalPhoneNumberId)
    const envio = await sendTextMessage(phoneNumberId, metaAccess.businessToken, telefoneCliente, textoFinal)
    const mensagemId = envio?.messages?.[0]?.id
    respondeuComSucesso = true

    if (mensagemId) {
      await criarMensagem({
        id: mensagemId,
        contaId,
        from: phoneNumberId,
        to: telefoneCliente,
        text: textoFinal,
        timestamp: Math.floor(Date.now() / 1000),
        tipo: 'enviada',
        status: 'enviada',
      })
    }

    await marcarConversaEmAndamento(contaId, telefoneCliente).catch(() => {})

    // Sucesso — limpa qualquer erro anterior pra não deixar aviso obsoleto no painel.
    if (conta.ai.ultimoErro) {
      await registrarErroAgenteIA(contaId, null).catch(() => {})
    }
  } catch (error) {
    console.error('Erro ao processar mensagem com o agente de IA:', error)
    const mensagemErro = humanizarErroAgente(error)
    // Falha ao registrar o erro não pode gerar outro erro não tratado aqui —
    // essa função já roda em segundo plano via after(), sem ninguém esperando.
    await registrarErroAgenteIA(contaId, mensagemErro.slice(0, 500)).catch(() => {})

    // Cliente não pode ficar sem nenhuma resposta (ex: Gemini sobrecarregado,
    // 503) — um aviso genérico é melhor que silêncio total.
    if (!respondeuComSucesso) {
      try {
        const phoneNumberId = resolverPhoneNumberId(metaAccess, conversa?.canalPhoneNumberId)
        await sendTextMessage(phoneNumberId, metaAccess.businessToken, telefoneCliente, MENSAGEM_FALLBACK_IA)
      } catch (fallbackError) {
        console.error('Erro ao enviar aviso de indisponibilidade da IA:', fallbackError)
      }
    }
  }
}

function executarProvedor(provider: string, params: AgentRunParams): Promise<string> {
  switch (provider) {
    case 'openai':
      return runOpenAIAgent(params)
    case 'anthropic':
      return runAnthropicAgent(params)
    case 'gemini':
    default:
      return runGeminiAgent(params)
  }
}
