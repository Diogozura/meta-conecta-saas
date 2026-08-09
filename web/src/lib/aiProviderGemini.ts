import { GoogleGenerativeAI, SchemaType, FunctionDeclaration, Content, Part } from '@google/generative-ai'
import { FERRAMENTAS_AGENTE, executarFuncaoAgente } from '@/lib/aiAgentTools'
import { AgentRunParams, MAX_ITERACOES_AGENTE } from '@/lib/aiAgentTypes'

function paraFerramentasGemini(): FunctionDeclaration[] {
  return FERRAMENTAS_AGENTE.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT,
      properties: Object.fromEntries(t.params.map((p) => [p.name, { type: SchemaType.STRING, description: p.description }])),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }))
}

export async function runGeminiAgent(params: AgentRunParams): Promise<string> {
  const genAI = new GoogleGenerativeAI(params.apiKey)
  const model = genAI.getGenerativeModel({
    model: params.model,
    systemInstruction: params.systemPrompt,
    tools: [{ functionDeclarations: paraFerramentasGemini() }],
  })

  const history: Content[] = params.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }))
  const chat = model.startChat({ history })
  let result = await chat.sendMessage(params.mensagemAtual)

  for (let i = 0; i < MAX_ITERACOES_AGENTE; i++) {
    const chamadas = result.response.functionCalls()
    if (!chamadas || chamadas.length === 0) break

    const respostas: Part[] = []
    for (const chamada of chamadas) {
      const resultado = await executarFuncaoAgente(params.contaId, params.telefoneCliente, chamada.name, chamada.args as Record<string, unknown>)
      respostas.push({ functionResponse: { name: chamada.name, response: { resultado } } })
    }
    result = await chat.sendMessage(respostas)
  }

  return result.response.text().trim()
}
