/**
 * Checagem repetida em todas as rotas de IA do módulo Instagram (sugestão de legenda,
 * hashtags, pauta, resumo de comentários, assistente etc.) — todas usam a MESMA chave Gemini já
 * configurada em Configurações > Agente de IA (a mesma do agente do WhatsApp). Só um lugar pra
 * checar isso em vez de repetir em cada rota.
 */

import { obterConta } from '@/lib/firestore'

export interface GeminiDaConta {
  apiKey: string
  model: string
}

export async function obterGeminiDaConta(contaId: string): Promise<GeminiDaConta | null> {
  const conta = await obterConta(contaId)
  if (!conta?.ai?.apiKey || conta.ai.provider !== 'gemini') return null
  return { apiKey: conta.ai.apiKey, model: conta.ai.model || 'gemini-2.0-flash' }
}

export const ERRO_SEM_GEMINI = 'Configure uma chave da Gemini em Configurações > Agente de IA pra usar esse recurso.'
