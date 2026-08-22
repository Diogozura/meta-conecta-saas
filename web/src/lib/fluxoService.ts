import {
  obterFluxoAtivo,
  obterConversa,
  obterMetaAccess,
  criarMensagem,
  atualizarFluxoConversa,
  encaminharConversaParaFilaPeloFluxo,
  encerrarConversa,
  marcarConversaEmAndamento,
  salvarDadoColetado,
} from '@/lib/firestore'
import { sendTextMessage, sendButtonsMessage, sendListMessage } from '@/lib/meta'
import { continuarFluxo, encontrarNo, iniciarFluxo } from '@/lib/fluxoEngine'
import { enviarPedidoCsat } from '@/lib/csatService'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'
import { FLUXO_SAIU } from '@/types/database'

/**
 * Escolhe botões (até 3) ou lista (até 10) nativos do WhatsApp pras opções
 * de um nó de menu — melhor experiência que pedir pro cliente digitar o
 * rótulo exato. Cai pra texto simples (numeração manual do designer do
 * fluxo) quando as opções não cabem nos limites da Cloud API.
 */
async function enviarMenuInterativo(
  metaAccess: { phoneNumberId: string; businessToken: string },
  numero: string,
  texto: string,
  opcoes: { id: string; rotulo: string }[],
) {
  if (opcoes.length >= 1 && opcoes.length <= 3 && opcoes.every((o) => o.rotulo.length <= 20)) {
    return sendButtonsMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto, opcoes.map((o) => ({ id: o.id, title: o.rotulo })))
  }
  if (opcoes.length >= 1 && opcoes.length <= 10 && opcoes.every((o) => o.rotulo.length <= 24)) {
    return sendListMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto, 'Escolher', opcoes.map((o) => ({ id: o.id, title: o.rotulo })))
  }
  return sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto)
}

/**
 * Processa uma mensagem recebida através do Fluxo de atendimento da conta
 * (se houver um configurado e ligado). Chamado pelo webhook ANTES do agente
 * de IA — o fluxo decide se a conversa segue por um menu, vai pra IA, entra
 * na fila humana ou encerra.
 *
 * Retorna `true` se o fluxo tratou a mensagem (nada mais deve responder a
 * ela) e `false` quando não há fluxo ativo para essa conta ou o fluxo
 * decidiu encaminhar pra IA — nos dois casos o chamador deve seguir com o
 * comportamento de sempre (`processarMensagemComIA`).
 */
export async function processarMensagemComFluxo(contaId: string, numero: string, textoRecebido: string): Promise<boolean> {
  const fluxo = await obterFluxoAtivo(contaId)
  if (!fluxo) return false

  const conversa = await obterConversa(contaId, numero)

  // Já foi entregue pro agente de IA (ou pra fila humana) por esse fluxo
  // antes — não reentra no menu a cada mensagem nova enquanto durar essa
  // conversa. Só volta ao fluxo se a conversa for reaberta do zero
  // (garantirConversaAberta reseta esse marcador ao reabrir).
  if (conversa?.fluxoNoAtualId === FLUXO_SAIU) return false

  // Se a conversa estava parada num nó "coleta", a resposta que acabou de
  // chegar É o dado sendo coletado — guarda antes de decidir o próximo
  // passo (o motor só decide roteamento, não sabe onde persistir).
  if (conversa?.fluxoNoAtualId) {
    const noAtual = encontrarNo(fluxo, conversa.fluxoNoAtualId)
    if (noAtual?.tipo === 'coleta' && noAtual.variavel) {
      await salvarDadoColetado(contaId, numero, noAtual.variavel, textoRecebido)
    }
  }

  const resultado = conversa?.fluxoNoAtualId
    ? continuarFluxo(fluxo, conversa.fluxoNoAtualId, textoRecebido)
    : iniciarFluxo(fluxo)

  if (resultado.mensagens.length > 0) {
    const metaAccessBase = await obterMetaAccess(contaId)
    if (metaAccessBase) {
      // Responde pelo mesmo número em que o cliente escreveu (contas com
      // mais de um número de WhatsApp) — cai pro principal se a conversa não
      // tiver canal salvo ou ele não pertencer mais à conta.
      const metaAccess = { ...metaAccessBase, phoneNumberId: resolverPhoneNumberId(metaAccessBase, conversa?.canalPhoneNumberId) }

      // Última mensagem de um 'enviar_e_aguardar'/'opcao_invalida' num nó de
      // menu vira botões/lista nativos — as demais (nós 'mensagem' no
      // caminho até o menu) seguem como texto simples.
      const noDestino = resultado.acao === 'enviar_e_aguardar' || resultado.acao === 'opcao_invalida' ? encontrarNo(fluxo, resultado.noId) : undefined
      const opcoesInterativas = noDestino?.tipo === 'menu' ? (noDestino.opcoes ?? []).filter((o) => o.rotulo.trim()) : []

      for (let i = 0; i < resultado.mensagens.length; i++) {
        const texto = resultado.mensagens[i]
        const ehUltimaEInterativa = i === resultado.mensagens.length - 1 && opcoesInterativas.length > 0
        try {
          const envio = ehUltimaEInterativa
            ? await enviarMenuInterativo(metaAccess, numero, texto, opcoesInterativas)
            : await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto)
          const mensagemId = envio?.messages?.[0]?.id
          if (mensagemId) {
            await criarMensagem({
              id: mensagemId,
              contaId,
              from: metaAccess.phoneNumberId,
              to: numero,
              text: texto,
              timestamp: Math.floor(Date.now() / 1000),
              tipo: 'enviada',
              status: 'enviada',
            })
          }
        } catch (error) {
          console.error('Erro ao enviar mensagem do fluxo de atendimento:', error)
        }
      }
    }
  }

  switch (resultado.acao) {
    case 'enviar_e_aguardar':
    case 'opcao_invalida':
      await atualizarFluxoConversa(contaId, numero, resultado.noId)
      await marcarConversaEmAndamento(contaId, numero)
      return true

    case 'encaminhar_ia':
      // Marca como "saiu do fluxo" — a partir daqui é o agente de IA de
      // sempre que responde; o fluxo só reentra se a conversa for reaberta.
      await atualizarFluxoConversa(contaId, numero, FLUXO_SAIU)
      return false

    case 'encaminhar_humano':
      await encaminharConversaParaFilaPeloFluxo(contaId, numero, resultado.setor, resultado.motivo)
      return true

    case 'encerrar':
      await atualizarFluxoConversa(contaId, numero, null)
      await encerrarConversa(contaId, numero, 'fluxo')
      await enviarPedidoCsat(contaId, numero).catch(() => {})
      return true
  }
}
