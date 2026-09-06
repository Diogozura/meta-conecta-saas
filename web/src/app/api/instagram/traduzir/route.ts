import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'

// POST /api/instagram/traduzir - Traduz um comentário/DM pro português antes de responder
// (usa a mesma chave Gemini do agente de IA do WhatsApp). Reusável pra comentário ou DM — só
// recebe o texto solto, sem amarrar a nenhum dos dois.
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

  const body = await request.json().catch(() => null)
  const texto = typeof body?.texto === 'string' ? body.texto.trim() : ''
  if (!texto) {
    return NextResponse.json({ error: 'texto é obrigatório' }, { status: 400 })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: conta.ai.apiKey })
    const prompt = `Traduza o texto abaixo pro português do Brasil. Se já estiver em português, devolva ele exatamente igual. Responda só com a tradução, sem aspas nem explicação.\n\nTexto: ${texto}`
    const result = await ai.models.generateContent({
      model: conta.ai.model || 'gemini-2.0-flash',
      contents: [{ text: prompt }],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const traducao = (result.text ?? '').trim()
    if (!traducao) {
      return NextResponse.json({ error: 'A IA não devolveu nenhuma tradução — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ traducao })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
