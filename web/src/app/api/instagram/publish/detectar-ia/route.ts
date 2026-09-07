import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { obterGeminiDaConta } from '@/lib/geminiInstagram'

const PROMPT = 'Essa imagem parece ter sido gerada ou fortemente editada por inteligência artificial (ex: Midjourney, DALL-E, Stable Diffusion, Photoshop generative fill)? Responda só uma palavra: "sim", "nao" ou "incerto".'

// POST /api/instagram/publish/detectar-ia - Sinaliza (heurística, por IA — não é garantia) se uma
// imagem parece gerada por IA, pra pré-marcar o selo de "conteúdo gerado por IA" antes de publicar
// (o Instagram exige essa transparência; decidir sozinho de olho na imagem é fácil de esquecer).
// Sem chave Gemini configurada, devolve "incerto" (best-effort, nunca bloqueia o fluxo de publicar).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const gemini = await obterGeminiDaConta(contaId)
  if (!gemini) {
    return NextResponse.json({ resultado: 'incerto' })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Envie uma imagem.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateContent({
      model: gemini.model,
      contents: [{ text: PROMPT }, { inlineData: { mimeType: file.type, data: buffer.toString('base64') } }],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().toLowerCase()
    const resultado = texto.includes('sim') ? 'sim' : texto.includes('nao') || texto.includes('não') ? 'nao' : 'incerto'
    return NextResponse.json({ resultado })
  } catch {
    // Best-effort — falha na detecção não pode travar o fluxo de publicar.
    return NextResponse.json({ resultado: 'incerto' })
  }
}
