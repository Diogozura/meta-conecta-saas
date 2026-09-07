import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { uploadInstagramMedia } from '@/lib/storage'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

const IMAGE_MODEL = 'imagen-4.0-generate-001'

// POST /api/instagram/publish/gerar-imagem - Gera uma imagem (Imagen, via a mesma chave Gemini)
// a partir de um prompt em texto — devolve a URL pública já hospedada, pra virar um arquivo
// normal no compositor (mesmo fluxo de sempre: corte, marca d'água, agendamento).
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
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ error: 'Descreva a imagem que você quer gerar.' }, { status: 400 })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateImages({
      model: IMAGE_MODEL,
      prompt,
      config: { numberOfImages: 1 },
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const imagem = result.generatedImages?.[0]?.image
    if (!imagem?.imageBytes) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma imagem — tente descrever de outro jeito.' }, { status: 502 })
    }

    const buffer = Buffer.from(imagem.imageBytes, 'base64')
    const contentType = imagem.mimeType ?? 'image/png'
    const uploaded = await uploadInstagramMedia(contaId, buffer, contentType, `ia-${Date.now()}`)
    return NextResponse.json({ url: uploaded.url })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
