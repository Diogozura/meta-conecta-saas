import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

const PROMPT_BASE = 'Você ajuda a escrever legendas pro Instagram de uma empresa. Olhe a imagem e escreva 3 sugestões de legenda DIFERENTES entre si (tons/abordagens variados) em português do Brasil, cada uma curta (no máximo 2-3 frases) e natural, com 2 a 5 hashtags relevantes ao final. Responda só um JSON válido: um array de 3 strings, sem nenhum texto além do JSON.'

// Mesma lógica de retry usada pro agente do WhatsApp (aiProviderGemini.ts) —
// reimplementada aqui pra não acoplar essa rota ao módulo do agente conversacional.
async function comRetentativa<T>(fn: () => Promise<T>): Promise<T> {
  const MAX_TENTATIVAS_EXTRA = 2
  for (let tentativa = 0; ; tentativa++) {
    try {
      return await fn()
    } catch (error) {
      const status = error && typeof error === 'object' ? (error as { status?: unknown }).status : undefined
      if (status !== 503 || tentativa >= MAX_TENTATIVAS_EXTRA) throw error
      await new Promise((resolve) => setTimeout(resolve, 1000 * (tentativa + 1)))
    }
  }
}

// POST /api/instagram/publish/caption-suggestion - Gera 3 sugestões de legenda a partir de uma
// imagem, usando a chave Gemini já configurada pela conta em Configurações (mesma usada pelo
// agente de IA do WhatsApp). Só funciona com provider 'gemini' — é o único com suporte a imagem
// já comprovado no restante do código (ver aiProviderGemini.ts).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const gemini = await obterGeminiDaConta(contaId)
  if (!gemini) {
    return NextResponse.json({ error: ERRO_SEM_GEMINI }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const brief = formData.get('brief')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie uma imagem.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const prompt = typeof brief === 'string' && brief.trim() ? `${PROMPT_BASE}\n\nContexto adicional: ${brief.trim()}` : PROMPT_BASE

    const result = await comRetentativa(() =>
      ai.models.generateContent({
        model: gemini.model,
        contents: [{ text: prompt }, { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }],
      }),
    )
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')
    let captions: string[]
    try {
      const parsed = JSON.parse(texto)
      captions = Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string' && !!c.trim()) : []
    } catch {
      // A IA não devolveu JSON válido — trata a resposta inteira como uma única sugestão em vez de falhar.
      captions = texto ? [texto] : []
    }

    if (captions.length === 0) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma sugestão — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ captions })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
