/**
 * Resposta automática por IA pras perguntas frequentes cadastradas (ver
 * InstagramPublishConfig.faqAtiva e PerguntaFrequenteInstagram) — usado tanto em comentários
 * quanto em DMs novas (ver api/webhook/route.ts). Só responde quando bate com uma pergunta
 * cadastrada; nunca é um agente livre tipo o do WhatsApp (aiProviderGemini.ts).
 */

import { GoogleGenAI } from '@google/genai'
import { obterConta, listarPerguntasFrequentesInstagram, registrarUsoAgenteIA } from '@/lib/firestore'

/** Devolve a resposta cadastrada se `textoRecebido` bater com alguma pergunta frequente, ou `null` (não bate/não configurado/erro). Nunca lança. */
export async function encontrarRespostaFaq(contaId: string, textoRecebido: string): Promise<string | null> {
  if (!textoRecebido.trim()) return null
  try {
    const [conta, perguntas] = await Promise.all([obterConta(contaId), listarPerguntasFrequentesInstagram(contaId)])
    if (!conta?.instagramPublishConfig?.faqAtiva) return null
    if (!conta.ai?.apiKey || conta.ai.provider !== 'gemini') return null
    if (perguntas.length === 0) return null

    const ai = new GoogleGenAI({ apiKey: conta.ai.apiKey })
    const lista = perguntas.map((p, i) => `${i}. ${p.pergunta}`).join('\n')
    const prompt = `Uma pessoa mandou esta mensagem pro Instagram de uma empresa: "${textoRecebido}"\n\nLista de perguntas frequentes cadastradas pela empresa:\n${lista}\n\nSe a mensagem corresponder claramente a UMA dessas perguntas, responda só com o número dela. Se não tiver certeza ou não corresponder a nenhuma, responda só "nenhuma". Não invente número fora da lista.`
    const result = await ai.models.generateContent({
      model: conta.ai.model || 'gemini-2.0-flash',
      contents: [{ text: prompt }],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const indice = Number((result.text ?? '').trim())
    if (!Number.isInteger(indice) || indice < 0 || indice >= perguntas.length) return null
    return perguntas[indice].resposta
  } catch (err) {
    console.error('Erro ao tentar casar com FAQ (best-effort, não bloqueia nada):', err)
    return null
  }
}
