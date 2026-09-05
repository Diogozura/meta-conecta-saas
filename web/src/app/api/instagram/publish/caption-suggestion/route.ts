import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'

const PROMPT_BASE = 'Você ajuda a escrever legendas pro Instagram de uma empresa. Olhe a imagem e escreva UMA sugestão de legenda em português do Brasil, curta (no máximo 2-3 frases), natural e com 2 a 5 hashtags relevantes ao final. Responda só com o texto da legenda, sem aspas, sem explicação.'

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

// POST /api/instagram/publish/caption-suggestion - Gera uma sugestão de legenda a partir
// de uma imagem, usando a chave Gemini já configurada pela conta em Configurações (mesma
// usada pelo agente de IA do WhatsApp). Só funciona com provider 'gemini' — é o único com
// suporte a imagem já comprovado no restante do código (ver aiProviderGemini.ts).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const conta = await obterConta(contaId)
  if (!conta?.ai?.apiKey || conta.ai.provider !== 'gemini') {
    return NextResponse.json({ error: 'Configure uma chave da Gemini em Configurações > Agente de IA pra usar esse recurso.' }, { status: 400 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const brief = formData.get('brief')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie uma imagem.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ai = new GoogleGenAI({ apiKey: conta.ai.apiKey })
    const prompt = typeof brief === 'string' && brief.trim() ? `${PROMPT_BASE}\n\nContexto adicional: ${brief.trim()}` : PROMPT_BASE

    const result = await comRetentativa(() =>
      ai.models.generateContent({
        model: conta.ai!.model || 'gemini-2.0-flash',
        contents: [{ text: prompt }, { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }],
      }),
    )
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const caption = (result.text ?? '').trim()
    if (!caption) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma sugestão — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ caption })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
