/**
 * Parágrafo em linguagem natural pro relatório semanal do Instagram (ver
 * lib/notificacoes.ts::emailRelatorioSemanalInstagram) — usa a mesma chave Gemini já configurada
 * pela conta. Best-effort: sem chave configurada ou em caso de erro, devolve `undefined` e o
 * e-mail sai só com os números (comportamento de sempre).
 */

import { GoogleGenAI } from '@google/genai'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { obterGeminiDaConta } from '@/lib/geminiInstagram'
import type { RelatorioSemanalInstagramParams } from '@/lib/notificacoes'

export async function gerarResumoNaturalRelatorio(contaId: string, params: Omit<RelatorioSemanalInstagramParams, 'resumoNatural'>): Promise<string | undefined> {
  const gemini = await obterGeminiDaConta(contaId)
  if (!gemini) return undefined

  try {
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const prompt = `Escreva UM parágrafo curto (2-3 frases), em português do Brasil, num tom direto e amigável, resumindo essa semana do Instagram de uma empresa com base nestes números:
- Seguidores: ${params.seguidores ?? 'não disponível'}${params.crescimentoSemana !== undefined ? ` (variação na semana: ${params.crescimentoSemana >= 0 ? '+' : ''}${params.crescimentoSemana})` : ''}
- Publicações feitas: ${params.publicacoesNaSemana}
- Curtidas recebidas: ${params.curtidas}
- Comentários recebidos: ${params.comentarios}

Comente se a semana foi boa, fraca ou mediana e por quê, sem inventar números que não foram dados. Responda só com o parágrafo, sem título nem explicação.`
    const result = await ai.models.generateContent({ model: gemini.model, contents: [{ text: prompt }] })
    await registrarUsoAgenteIA(contaId).catch(() => {})
    return (result.text ?? '').trim() || undefined
  } catch (err) {
    console.warn('Falha ao gerar resumo natural do relatório semanal (best-effort):', err)
    return undefined
  }
}
