import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'

const SENTIMENTOS = ['elogio', 'duvida', 'reclamacao', 'outro'] as const
type Sentimento = (typeof SENTIMENTOS)[number]

const PROMPT = `Classifique cada comentário do Instagram abaixo em EXATAMENTE um destes rótulos: elogio, duvida, reclamacao, outro.
Responda só um JSON válido, um array de objetos {"id": "...", "sentimento": "..."}, na mesma ordem, sem nenhum texto além do JSON.

Comentários:
`

// POST /api/instagram/comments/classificar - Classifica um lote de comentários por sentimento
// usando a chave Gemini já configurada pela conta (mesma do agente de IA do WhatsApp).
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
  const comentarios: unknown[] = Array.isArray(body?.comentarios) ? body.comentarios : []
  const validos: { id: string; text: string }[] = comentarios
    .filter((c): c is { id: string; text: string } =>
      !!c && typeof c === 'object' && typeof (c as Record<string, unknown>).id === 'string' && typeof (c as Record<string, unknown>).text === 'string',
    )
    .slice(0, 30) // lote pequeno — é pra classificar o que já está na tela, não o histórico inteiro

  if (validos.length === 0) {
    return NextResponse.json({ error: 'Nenhum comentário válido enviado.' }, { status: 400 })
  }

  try {
    const ai = new GoogleGenAI({ apiKey: conta.ai.apiKey })
    const prompt = PROMPT + validos.map((c) => `[${c.id}] ${c.text}`).join('\n')
    const result = await ai.models.generateContent({
      model: conta.ai.model || 'gemini-2.0-flash',
      contents: [{ text: prompt }],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const texto = (result.text ?? '').trim().replace(/^```json\s*|\s*```$/g, '')
    const parsed = JSON.parse(texto) as { id: string; sentimento: string }[]
    const classificacoes: Record<string, Sentimento> = {}
    for (const item of parsed) {
      if (typeof item.id === 'string' && SENTIMENTOS.includes(item.sentimento as Sentimento)) {
        classificacoes[item.id] = item.sentimento as Sentimento
      }
    }
    return NextResponse.json({ classificacoes })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
