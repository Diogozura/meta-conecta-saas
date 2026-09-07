import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { getInstagramCredentials, listRecentMedia } from '@/lib/instagram'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

const TOP_N = 6

// GET /api/instagram/publish/sugerir-pauta - Olha as publicações que mais engajaram (curtidas +
// comentários) entre as mais recentes e sugere pautas novas inspiradas no que já funcionou.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const gemini = await obterGeminiDaConta(contaId)
  if (!gemini) {
    return NextResponse.json({ error: ERRO_SEM_GEMINI }, { status: 400 })
  }

  try {
    const credentials = await getInstagramCredentials()
    const conta = await obterConta(contaId)
    const media = await listRecentMedia(credentials.accessToken, credentials.igUserId, 25)

    const comEngajamento = media
      .map((m) => ({ ...m, engajamento: (m.like_count ?? 0) + (m.comments_count ?? 0) * 2 }))
      .filter((m) => m.caption)
      .sort((a, b) => b.engajamento - a.engajamento)
      .slice(0, TOP_N)

    if (comEngajamento.length === 0) {
      return NextResponse.json({ error: 'Ainda não tem publicações com legenda suficientes pra analisar o que performa bem.' }, { status: 400 })
    }

    const contexto = conta?.ai?.informacoesNegocio ? `\n\nContexto do negócio: ${conta.ai.informacoesNegocio}` : ''
    const listaPosts = comEngajamento.map((m, i) => `${i + 1}. (${m.like_count ?? 0} curtidas, ${m.comments_count ?? 0} comentários) "${m.caption}"`).join('\n')
    const prompt = `Aqui estão as publicações do Instagram dessa empresa que mais engajaram recentemente:${contexto}\n\n${listaPosts}\n\nCom base no que parece ter funcionado bem (tema, formato, tom), sugira 5 pautas NOVAS pra próximas publicações — não repita os posts acima, proponha ideias inspiradas neles. Responda só um JSON válido: um array de 5 strings curtas (1 frase cada), sem nenhum texto além do JSON.`

    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateContent({ model: gemini.model, contents: [{ text: prompt }] })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(texto)
    const sugestoes = Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && !!s.trim()) : []

    if (sugestoes.length === 0) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma sugestão — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ sugestoes, baseadoEm: comEngajamento.length })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
