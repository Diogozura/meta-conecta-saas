import { NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { registrarUsoAgenteIA } from '@/lib/firestore'
import { getInstagramCredentials, listMediaComments } from '@/lib/instagram'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

// POST /api/instagram/media/[id]/resumo-comentarios - Resume os comentários de um post em
// "principais dúvidas" e "principais elogios/feedback positivo".
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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
    const comments = await listMediaComments(credentials.accessToken, id, { igUserId: credentials.igUserId, username: credentials.username })
    if (comments.length === 0) {
      return NextResponse.json({ error: 'Esse post ainda não tem comentários pra resumir.' }, { status: 400 })
    }

    const lista = comments.slice(0, 100).map((c) => `- ${c.text}`).join('\n')
    const prompt = `Aqui estão os comentários de um post do Instagram:\n${lista}\n\nResuma em português do Brasil, em até 5 tópicos de "Principais dúvidas" e até 5 tópicos de "Principais elogios/feedback positivo" (pode ter menos se não houver o suficiente de algum tipo). Responda só um JSON válido no formato {"duvidas": ["..."], "elogios": ["..."]}, sem nenhum texto além do JSON.`

    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateContent({ model: gemini.model, contents: [{ text: prompt }] })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(texto) as { duvidas?: unknown; elogios?: unknown }
    const duvidas = Array.isArray(parsed.duvidas) ? parsed.duvidas.filter((d): d is string => typeof d === 'string') : []
    const elogios = Array.isArray(parsed.elogios) ? parsed.elogios.filter((e): e is string => typeof e === 'string') : []

    return NextResponse.json({ duvidas, elogios, totalComentarios: comments.length })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
