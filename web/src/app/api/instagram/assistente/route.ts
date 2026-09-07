import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { auth } from '@/lib/auth'
import { obterConta, registrarUsoAgenteIA, listarPublicacoesInstagram } from '@/lib/firestore'
import { humanizarErroAgente } from '@/lib/aiAgentTypes'
import { obterGeminiDaConta, ERRO_SEM_GEMINI } from '@/lib/geminiInstagram'

const SYSTEM_PROMPT = 'Você é um assistente dentro do painel de gestão do Instagram de uma empresa (Zybot). Ajuda com dúvidas sobre estratégia de conteúdo, melhores horários pra postar, ideias de pauta e organização do calendário editorial. Seja direto e prático, em português do Brasil, respostas curtas (no máximo 1 parágrafo curto, a menos que peçam mais detalhe). Você NÃO publica nem agenda nada sozinho — só orienta; se a pessoa quiser agendar algo, diga pra usar a aba Publicar.'

// POST /api/instagram/assistente - Chat simples (histórico mantido pelo cliente, reenviado a
// cada pergunta) com contexto básico do calendário de publicações da conta.
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
  const pergunta = typeof body?.pergunta === 'string' ? body.pergunta.trim() : ''
  const historico: { role: 'user' | 'model'; text: string }[] = Array.isArray(body?.historico)
    ? body.historico
        .filter((h: unknown): h is { role: 'user' | 'model'; text: string } =>
          !!h && typeof h === 'object'
          && ((h as { role?: unknown }).role === 'user' || (h as { role?: unknown }).role === 'model')
          && typeof (h as { text?: unknown }).text === 'string',
        )
        .slice(-20) // limita o histórico reenviado — não precisa da conversa inteira pra manter contexto útil
    : []
  if (!pergunta) {
    return NextResponse.json({ error: 'Escreva uma pergunta.' }, { status: 400 })
  }

  try {
    const [conta, publicacoes] = await Promise.all([
      obterConta(contaId),
      listarPublicacoesInstagram(contaId, 30).catch(() => []),
    ])

    const agendadas = publicacoes.filter((p) => p.status === 'agendado' && p.agendadoPara)
    const contextoAgenda = agendadas.length > 0
      ? `Publicações já agendadas: ${agendadas.slice(0, 10).map((p) => `${p.tipo} em ${new Date(p.agendadoPara!).toLocaleString('pt-BR')}`).join('; ')}.`
      : 'Não há publicações agendadas no momento.'
    const contextoNegocio = conta?.ai?.informacoesNegocio ? `Sobre o negócio: ${conta.ai.informacoesNegocio}` : ''

    const ai = new GoogleGenAI({ apiKey: gemini.apiKey })
    const result = await ai.models.generateContent({
      model: gemini.model,
      contents: [
        { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n${contextoNegocio}\n${contextoAgenda}` }] },
        { role: 'model', parts: [{ text: 'Entendido, pode perguntar.' }] },
        ...historico.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
        { role: 'user', parts: [{ text: pergunta }] },
      ],
    })
    await registrarUsoAgenteIA(contaId).catch(() => {})

    const resposta = (result.text ?? '').trim()
    if (!resposta) {
      return NextResponse.json({ error: 'A IA não devolveu resposta — tente de novo.' }, { status: 502 })
    }
    return NextResponse.json({ resposta })
  } catch (err) {
    return NextResponse.json({ error: humanizarErroAgente(err) }, { status: 502 })
  }
}
