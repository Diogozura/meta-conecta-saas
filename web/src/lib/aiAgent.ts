import { obterConta, obterMetaAccess, listarMensagensPorNumero, criarMensagem, obterConversa, registrarErroAgenteIA } from '@/lib/firestore'
import { sendTextMessage } from '@/lib/meta'
import { runGeminiAgent } from '@/lib/aiProviderGemini'
import { runOpenAIAgent } from '@/lib/aiProviderOpenAI'
import { runAnthropicAgent } from '@/lib/aiProviderAnthropic'
import { AgentRunParams, humanizarErroAgente } from '@/lib/aiAgentTypes'

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

  try {
    const mensagens = await listarMensagensPorNumero(contaId, telefoneCliente, 20)
    const ordenadas = [...mensagens].sort((a, b) => a.timestamp - b.timestamp)
    const ultima = ordenadas.pop()
    if (!ultima) return // nada pra responder

    const systemPrompt = conta.ai.informacoesNegocio
      ? `${conta.ai.prompt}\n\n--- Informações do negócio ---\n${conta.ai.informacoesNegocio}`
      : conta.ai.prompt

    const runParams: AgentRunParams = {
      contaId,
      telefoneCliente,
      systemPrompt,
      model: conta.ai.model,
      apiKey: conta.ai.apiKey,
      history: ordenadas.map((m) => ({ role: m.tipo === 'recebida' ? 'user' as const : 'model' as const, text: m.text })),
      mensagemAtual: ultima.text,
    }

    const textoFinal = await executarProvedor(conta.ai.provider, runParams)
    if (!textoFinal) return

    const envio = await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, telefoneCliente, textoFinal)
    const mensagemId = envio?.messages?.[0]?.id

    if (mensagemId) {
      await criarMensagem({
        id: mensagemId,
        contaId,
        from: metaAccess.phoneNumberId,
        to: telefoneCliente,
        text: textoFinal,
        timestamp: Math.floor(Date.now() / 1000),
        tipo: 'enviada',
        status: 'enviada',
      })
    }

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
