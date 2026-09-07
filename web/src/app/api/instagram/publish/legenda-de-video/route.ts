import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

const PROMPT = 'Assista/escute esse vídeo (Reels) e transcreva o que é falado. Com base na transcrição e no conteúdo visual, escreva uma legenda pro Instagram em português do Brasil, curta e natural (no máximo 3-4 frases), com 2 a 5 hashtags relevantes ao final. Responda só com o texto da legenda, sem aspas nem explicação — não inclua a transcrição bruta na resposta.'

// Vídeo é multimodal (bytes em base64 no corpo da requisição pra Gemini) — arquivo grande demais
// deixaria a requisição pesada e lenta, então limita a um tamanho razoável pra um Reels curto.
const MAX_BYTES = 30 * 1024 * 1024

// POST /api/instagram/publish/legenda-de-video - Transcreve a fala de um vídeo/Reels e já
// devolve pronta uma sugestão de legenda baseada nela (Gemini entende vídeo nativamente).
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
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie um vídeo.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Vídeo grande demais pra transcrever automaticamente (limite de 30MB) — use o corte pra encurtar antes.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateContent({
      model: gemini.model,
      contents: [{ text: PROMPT }, { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const caption = (result.text ?? '').trim()
    if (!caption) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma legenda — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ caption })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
