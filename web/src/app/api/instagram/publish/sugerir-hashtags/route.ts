import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

// POST /api/instagram/publish/sugerir-hashtags - Sugere hashtags relevantes com base na legenda
// (e, se a conta tiver preenchido, no contexto do negócio em Configurações > Agente de IA).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const gemini = await obterGeminiDaConta(contaId)
  if (!gemini) {
    return NextResponse.json({ error: ERRO_SEM_GEMINI }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const caption = typeof body?.caption === 'string' ? body.caption.trim() : ''
  if (!caption) {
    return NextResponse.json({ error: 'Escreva (ou gere) a legenda antes de pedir hashtags.' }, { status: 400 })
  }

  try {
    const conta = await obterConta(contaId)
    const contexto = conta?.ai?.informacoesNegocio ? `\n\nContexto do negócio: ${conta.ai.informacoesNegocio}` : ''
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const prompt = `Sugira de 8 a 12 hashtags do Instagram relevantes pra esta legenda, em português (misture algumas populares e outras mais específicas de nicho, evite hashtags genéricas demais tipo #instagood).${contexto}\n\nLegenda: ${caption}\n\nResponda só um JSON válido: um array de strings, cada uma SEM o "#", sem nenhum texto além do JSON.`
    const result = await ai.models.generateContent({ model: gemini.model, contents: [{ text: prompt }] })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(texto)
    const hashtags = Array.isArray(parsed) ? parsed.filter((h): h is string => typeof h === 'string' && !!h.trim()).map((h) => h.replace(/^#/, '').trim()) : []

    if (hashtags.length === 0) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma sugestão — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ hashtags })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
