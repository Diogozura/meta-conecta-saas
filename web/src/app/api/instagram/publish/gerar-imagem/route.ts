import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { uploadInstagramMedia } from '@/lib/storage'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

// Os modelos "imagen-4.0-generate-001" e "imagen-3.0-generate-002" (tentados antes) devolveram 404
// "not found for API version v1beta, or is not supported for predict" ao vivo — a família Imagen
// (endpoint `predict`) não está disponível pra chave/API pública do Gemini usada aqui (é recurso do
// Vertex AI). O próprio SDK @google/genai instalado já nem lista mais nomes "imagen-*": ele tipa os
// modelos de geração de imagem como modelos Gemini normais com sufixo "-image" (ex.:
// "gemini-2.5-flash-image", conhecido como "Nano Banana"), acessados via generateContent comum
// (não generateImages/predict) — é esse o mecanismo usado agora.
const IMAGE_MODEL = 'gemini-2.5-flash-image'

// POST /api/instagram/publish/gerar-imagem - Gera uma imagem (via a mesma chave Gemini)
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
    const result = await ai.models.generateContent({
      model: IMAGE_MODEL,
      contents: prompt,
      config: { responseModalities: ['TEXT', 'IMAGE'] },
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const partes = result.candidates?.[0]?.content?.parts ?? []
    const imagem = partes.find((p) => p.inlineData?.data)?.inlineData
    if (!imagem?.data) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma imagem — tente descrever de outro jeito.' }, { status: 502 })
    }

    const buffer = Buffer.from(imagem.data, 'base64')
    const contentType = imagem.mimeType ?? 'image/png'
    const uploaded = await uploadInstagramMedia(contaId, buffer, contentType, 'imagem-gerada-por-ia')
    return NextResponse.json({ url: uploaded.url })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
