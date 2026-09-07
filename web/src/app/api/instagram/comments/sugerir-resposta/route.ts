import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

// POST /api/instagram/comments/sugerir-resposta - Sugere uma resposta pronta pra um comentário
// (preenche o campo de resposta, não envia sozinho) — complementa as respostas rápidas fixas,
// pra comentário que não bate com nenhuma delas.
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
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : ''
  if (!texto) {
    return NextResponse.json({ error: 'texto é obrigatório' }, { status: 400 })
  }

  try {
    const conta = await obterConta(contaId)
    const tomDeVoz = conta?.instagramPublishConfig?.guiaDeMarca?.tomDeVoz
    const contexto = [
      conta?.ai?.informacoesNegocio ? `Sobre o negócio: ${conta.ai.informacoesNegocio}` : '',
      tomDeVoz ? `Tom de voz da marca: ${tomDeVoz}` : '',
    ].filter(Boolean).join('\n')

    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const prompt = `Você responde comentários do Instagram de uma empresa.${contexto ? `\n${contexto}` : ''}\n\nComentário recebido: "${texto}"\n\nEscreva UMA resposta curta, simpática e natural em português do Brasil (1-2 frases). Responda só com o texto da resposta, sem aspas nem explicação.`
    const result = await ai.models.generateContent({ model: gemini.model, contents: [{ text: prompt }] })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const resposta = (result.text ?? '').trim()
    if (!resposta) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma sugestão — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ resposta })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
