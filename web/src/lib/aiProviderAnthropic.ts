import Anthropic from '@anthropic-ai/sdk'
import { FERRAMENTAS_AGENTE, executarFuncaoAgente } from '@/lib/aiAgentTools'
import { AgentRunParams, MAX_ITERACOES_AGENTE } from '@/lib/aiAgentTypes'

function paraFerramentasAnthropic(): Anthropic.Tool[] {
  return FERRAMENTAS_AGENTE.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(t.params.map((p) => [p.name, { type: 'string', description: p.description }])),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }))
}

export async function runAnthropicAgent(params: AgentRunParams): Promise<string> {
  const client = new Anthropic({ apiKey: params.apiKey })
  const tools = paraFerramentasAnthropic()

  const messages: Anthropic.MessageParam[] = [
    ...params.history.map((h): Anthropic.MessageParam => ({ role: h.role === 'model' ? 'assistant' : 'user', content: h.text })),
    { role: 'user', content: params.mensagemAtual },
  ]

  for (let i = 0; i < MAX_ITERACOES_AGENTE; i++) {
    const response = await client.messages.create({
      model: params.model,
      max_tokens: 2048,
      system: params.systemPrompt,
      tools,
      messages,
    })

    messages.push({ role: 'assistant', content: response.content })

    const usosDeFerramenta = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (usosDeFerramenta.length === 0) {
      const textos = response.content.filter((b): b is Anthropic.TextBlock => b.type === 'text')
      return textos.map((b) => b.text).join('\n').trim()
    }

    const resultados: Anthropic.ToolResultBlockParam[] = []
    for (const uso of usosDeFerramenta) {
      const resultado = await executarFuncaoAgente(params.contaId, params.telefoneCliente, uso.name, uso.input as Record<string, unknown>)
      resultados.push({ type: 'tool_result', tool_use_id: uso.id, content: JSON.stringify(resultado) })
    }
    messages.push({ role: 'user', content: resultados })
  }

  return ''
}
