import OpenAI from 'openai'
import { FERRAMENTAS_AGENTE, executarFuncaoAgente } from '@/lib/aiAgentTools'
import { AgentRunParams, MAX_ITERACOES_AGENTE } from '@/lib/aiAgentTypes'

function paraFerramentasOpenAI(): OpenAI.Chat.ChatCompletionTool[] {
  return FERRAMENTAS_AGENTE.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(t.params.map((p) => [p.name, { type: 'string', description: p.description }])),
        required: t.params.filter((p) => p.required).map((p) => p.name),
      },
    },
  }))
}

export async function runOpenAIAgent(params: AgentRunParams): Promise<string> {
  const client = new OpenAI({ apiKey: params.apiKey })
  const tools = paraFerramentasOpenAI()

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: params.systemPrompt },
    ...params.history.map((h): OpenAI.Chat.ChatCompletionMessageParam => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.text,
    })),
    { role: 'user', content: params.mensagemAtual },
  ]

  for (let i = 0; i < MAX_ITERACOES_AGENTE; i++) {
    const completion = await client.chat.completions.create({ model: params.model, messages, tools })
    const mensagem = completion.choices[0].message
    messages.push(mensagem)

    if (!mensagem.tool_calls || mensagem.tool_calls.length === 0) {
      return (mensagem.content ?? '').trim()
    }

    for (const chamada of mensagem.tool_calls) {
      if (chamada.type !== 'function') continue
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(chamada.function.arguments || '{}')
      } catch {
        // args malformados — segue com objeto vazio, a ferramenta reporta o que faltou
      }
      const resultado = await executarFuncaoAgente(params.contaId, params.telefoneCliente, chamada.function.name, args)
      messages.push({ role: 'tool', tool_call_id: chamada.id, content: JSON.stringify(resultado) })
    }
  }

  return ''
}
