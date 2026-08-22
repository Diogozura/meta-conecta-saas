import { GoogleGenAI, Type, FunctionDeclaration, Content, Part } from '@google/genai'
import { FERRAMENTAS_AGENTE, executarFuncaoAgente } from '@/lib/aiAgentTools'
import { AgentRunParams, MAX_ITERACOES_AGENTE } from '@/lib/aiAgentTypes'

/**
 * O Gemini às vezes devolve 503/UNAVAILABLE em picos de demanda — a própria
 * Google recomenda tentar de novo ("usually temporary"). Tenta até 2 vezes
 * a mais só nesse caso específico, com um intervalo curto — qualquer outro
 * erro (chave inválida, rate limit, etc.) propaga na primeira tentativa.
 */
async function comRetentativa<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_TENTATIVAS_EXTRA = 2
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn()
    } catch (error) {
      const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
      if (status !== 503 || tentativa >= MAX_TENTATIVAS_EXTRA) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (tentativa + 1)))
    }
  }
}

function paraFerramentasGemini(): FunctionDeclaration[] {
  return FERRAMENTAS_AGENTE.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: Type.OBJECT,
      properties: Object.fromEntries(t.params.map((p) => [p.name, { type: Type.STRING, description: p.description }])),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }))
}

export async function runGeminiAgent(params: AgentRunParams): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: params.apiKey })

  const history: Content[] = params.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }))
  const chat = ai.chats.create({
    model: params.model,
    config: {
      systemInstruction: params.systemPrompt,
      tools: [{ functionDeclarations: paraFerramentasGemini() }],
      maxOutputTokens: 2048,
    },
    history,
  })

  let result = await comRetentativa(() => chat.sendMessage({ message: params.mensagemAtual }))

  for (let i = 0; i < MAX_ITERACOES_AGENTE; i++) {
    const chamadas = result.functionCalls
    if (!chamadas || chamadas.length === 0) break

    // Sem role explícito: o SDK novo já combina as parts numa única content
    // com role 'user' (era isso que faltava no SDK antigo — ele mandava um
    // role 'function' que os modelos Gemini 3.x não aceitam mais).
    const respostas: Part[] = []
    for (const chamada of chamadas) {
      const resultado = await executarFuncaoAgente(
        params.contaId,
        params.telefoneCliente,
        chamada.name ?? '',
        (chamada.args ?? {}) as Record<string, unknown>
      )
      respostas.push({ functionResponse: { name: chamada.name, response: { resultado } } })
    }
    result = await comRetentativa(() => chat.sendMessage({ message: respostas }))
  }

  return (result.text ?? '').trim()
}
