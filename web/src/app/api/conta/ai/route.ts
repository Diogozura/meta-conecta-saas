import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarConta, obterConta } from '@/lib/firestore'

const PROMPT_PADRAO = `Você é o assistente de atendimento pelo WhatsApp desta empresa. Seja breve, cordial e direto.
Use as informações do negócio (abaixo) para responder dúvidas gerais — produtos, serviços, horário de funcionamento, endereço, políticas, etc.
Quando o cliente quiser marcar um horário, use as ferramentas disponíveis: consulte os serviços e horários livres antes de oferecer opções, e só crie o agendamento depois que o cliente confirmar um horário específico.
Se não conseguir resolver a dúvida ou o problema do cliente sozinho, ou se ele pedir para falar com uma pessoa, use a ferramenta transferir_para_humano — não tente adivinhar uma resposta que você não tem certeza.
Nunca invente horários, serviços ou informações que não vieram das ferramentas ou das informações do negócio.`

const PROVIDERS = ['gemini', 'openai', 'anthropic']

// GET /api/conta/ai - Configuração do agente de IA da conta (cada conta tem seu próprio provedor + chave)
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const conta = await obterConta(session.user.contaId)
  return NextResponse.json({
    ai: conta?.ai ?? { enabled: false, provider: 'gemini', model: 'gemini-2.0-flash', prompt: PROMPT_PADRAO, apiKey: '', informacoesNegocio: '' },
  })
}

// PUT /api/conta/ai - Atualiza a configuração do agente de IA da conta
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json()
  const { enabled, provider, model, prompt, apiKey, informacoesNegocio } = body

  if (typeof enabled !== 'boolean' || !provider || !model || !prompt) {
    return NextResponse.json({ error: 'enabled, provider, model e prompt são obrigatórios' }, { status: 400 })
  }
  if (!PROVIDERS.includes(provider)) {
    return NextResponse.json({ error: `provider deve ser um de: ${PROVIDERS.join(', ')}` }, { status: 400 })
  }
  if (enabled && !apiKey) {
    return NextResponse.json({ error: 'Cole a chave da API do provedor escolhido pra ativar o agente' }, { status: 400 })
  }

  try {
    // Se o campo vier vazio numa edição (usuário não mexeu na chave já salva),
    // mantém a chave anterior em vez de apagar — o valor decriptado só chega
    // aqui se o front reenviar o que carregou no GET.
    const contaAtual = apiKey ? null : await obterConta(session.user.contaId)
    const apiKeyFinal = apiKey || contaAtual?.ai?.apiKey || ''

    const ai = { enabled, provider, model, prompt, apiKey: apiKeyFinal, informacoesNegocio: informacoesNegocio ?? '' }
    await atualizarConta(session.user.contaId, { ai })
    return NextResponse.json({ ai })
  } catch (error) {
    console.error('Erro ao salvar configuração de IA:', error)
    return NextResponse.json({ error: 'Erro ao salvar configuração de IA' }, { status: 500 })
  }
}
