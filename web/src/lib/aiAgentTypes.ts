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

export const AGENT_PROVIDERS: { value: AgentProvider; label: string; modeloExemplo: string; ondeConseguirChave: string }[] = [
  { value: 'gemini', label: 'Google Gemini', modeloExemplo: 'gemini-2.0-flash', ondeConseguirChave: 'aistudio.google.com → Get API key' },
  { value: 'openai', label: 'OpenAI (ChatGPT)', modeloExemplo: 'gpt-4o-mini', ondeConseguirChave: 'platform.openai.com/api-keys' },
  { value: 'anthropic', label: 'Anthropic (Claude)', modeloExemplo: 'claude-opus-5', ondeConseguirChave: 'console.anthropic.com/settings/keys' },
]
