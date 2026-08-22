import { obterConversa, obterMetaAccess, criarMensagem, marcarAguardandoCsat, salvarAvaliacaoCsat } from '@/lib/firestore'
import { sendTextMessage } from '@/lib/meta'
import { extrairNotaCsat } from '@/lib/csat'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'

const PERGUNTA_CSAT = 'De 0 a 10, o quanto você recomendaria nosso atendimento? Responda só com o número 🙂'
const AGRADECIMENTO_CSAT = 'Muito obrigado pela nota! 🙏'

async function enviarEPersistir(contaId: string, numero: string, texto: string): Promise<void> {
  const metaAccess = await obterMetaAccess(contaId)
  if (!metaAccess) return
  const conversa = await obterConversa(contaId, numero)
  const phoneNumberId = resolverPhoneNumberId(metaAccess, conversa?.canalPhoneNumberId)
  const envio = await sendTextMessage(phoneNumberId, metaAccess.businessToken, numero, texto)
  const mensagemId = envio?.messages?.[0]?.id
  if (mensagemId) {
    await criarMensagem({
      id: mensagemId,
      contaId,
      from: phoneNumberId,
      to: numero,
      text: texto,
      timestamp: Math.floor(Date.now() / 1000),
      tipo: 'enviada',
      status: 'enviada',
    })
  }
}

/** Manda a pergunta de satisfação e marca a conversa aguardando a nota — chamado ao encerrar uma conversa (manual ou pelo nó "Fim" do fluxo). */
export async function enviarPedidoCsat(contaId: string, numero: string): Promise<void> {
  try {
    await enviarEPersistir(contaId, numero, PERGUNTA_CSAT)
    await marcarAguardandoCsat(contaId, numero, true)
  } catch (error) {
    console.error('Erro ao enviar pesquisa de satisfação:', error)
  }
}

/**
 * Se a conversa está esperando uma nota de CSAT, tenta interpretar essa
 * mensagem como a resposta. Retorna `true` quando tratou (o chamador não
 * deve repassar a mensagem pro fluxo/IA) — só uma tentativa: se o texto não
 * parece uma nota, desiste da pesquisa (não trava o cliente respondendo
 * fora do padrão) e deixa a mensagem seguir o caminho normal.
 */
export async function processarRespostaCsatSeAguardando(contaId: string, numero: string, texto: string): Promise<boolean> {
  const conversa = await obterConversa(contaId, numero)
  if (!conversa?.aguardandoCsat) return false

  await marcarAguardandoCsat(contaId, numero, false)

  const nota = extrairNotaCsat(texto)
  if (nota === null) return false

  await salvarAvaliacaoCsat(contaId, numero, nota)
  await enviarEPersistir(contaId, numero, AGRADECIMENTO_CSAT).catch((error) => {
    console.error('Erro ao agradecer pela avaliação CSAT:', error)
  })

  return true
}
