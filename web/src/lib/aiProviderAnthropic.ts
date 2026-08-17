import Anthropic from '@anthropic-ai/sdk'
import { FERRAMENTAS_AGENTE, executarFuncaoAgente } from '@/lib/aiAgentTools'
import { AgentRunParams, MAX_ITERACOES_AGENTE } from '@/lib/aiAgentTypes'

function paraFerramentasAnthropic(): Anthropic.Tool[] {
  const tools = FERRAMENTAS_AGENTE.map((t): Anthropic.Tool => ({
    name: t.name,
    description: t.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(t.params.map((p) => [p.name, { type: 'string', description: p.description }])),
      required: t.params.filter((p) => p.required).map((p) => p.name),
    },
  }))

  // Marca a última ferramenta como ponto de corte do cache: a Anthropic
  // cacheia tudo que vem antes desse marcador (tools + system), então as
  // iterações 2+ do loop de function-calling (mesma mensagem) e mensagens
  // seguintes da mesma conta (dentro do TTL) reaproveitam o prompt fixo
  // em vez de pagar preço cheio de novo.
  if (tools.length > 0) {
    tools[tools.length - 1] = { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } }
  }

  return tools
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
      system: [{ type: 'text', text: params.systemPrompt, cache_control: { type: 'ephemeral' } }],
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
