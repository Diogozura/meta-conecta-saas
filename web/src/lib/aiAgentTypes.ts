// Tipos compartilhados entre os adaptadores de provedor de IA
// (lib/aiProviderGemini.ts, aiProviderOpenAI.ts, aiProviderAnthropic.ts).

export const MAX_ITERACOES_AGENTE = 5 // limite de segurança pro loop de function calling

export interface HistoricoMensagem {
  role: 'user' | 'model'
  text: string
}

export interface AgentRunParams {
  contaId: string
  telefoneCliente: string
  systemPrompt: string
  model: string
  apiKey: string
  /** Histórico da conversa, em ordem cronológica, sem a mensagem atual. */
  history: HistoricoMensagem[]
  mensagemAtual: string
}

export type AgentProvider = 'gemini' | 'openai' | 'anthropic'

/**
 * Troca o erro cru do SDK (ex: "429 Too Many Requests", "RESOURCE_EXHAUSTED")
 * por uma mensagem legível, pro banner de erro em Configurações. As 3 SDKs
 * (openai, @anthropic-ai/sdk, @google/genai) expõem `.status` com o código
 * HTTP da resposta, então dá pra detectar rate limit/cota de forma unificada
 * sem depender do formato específico de mensagem de cada provedor.
 */
export function humanizarErroAgente(error: unknown): string {
  const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
  const mensagem = error instanceof Error ? error.message : String(error)

  if (status === 429 || /rate.?limit|resource_exhausted|too many requests/i.test(mensagem)) {
    return 'O agente de IA atingiu o limite de uso (rate limit) do provedor configurado. Aguarde alguns minutos ou verifique o plano/cota da chave de API em uso.'
  }

  return mensagem
}

export const AGENT_PROVIDERS: { value: AgentProvider; label: string; modeloExemplo: string; ondeConseguirChave: string }[] = [
  { value: 'gemini', label: 'Google Gemini', modeloExemplo: 'gemini-2.5-flash', ondeConseguirChave: 'aistudio.google.com → Get API key' },
  { value: 'openai', label: 'OpenAI (ChatGPT)', modeloExemplo: 'gpt-4o-mini', ondeConseguirChave: 'platform.openai.com/api-keys' },
  { value: 'anthropic', label: 'Anthropic (Claude)', modeloExemplo: 'claude-opus-5', ondeConseguirChave: 'console.anthropic.com/settings/keys' },
]
