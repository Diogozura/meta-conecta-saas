import QRCode from 'qrcode'
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
  adicionarEtiquetaConversa,
  definirProtocoloConversa,
} from '@/lib/firestore'
import { sendTextMessage, sendButtonsMessage, sendListMessage, sendTemplateMessage, sendCtaUrlMessage, sendLocationRequestMessage, uploadMediaToMeta, sendMediaMessage } from '@/lib/meta'
import { continuarFluxo, encontrarNo, iniciarFluxo, type AcaoFluxo } from '@/lib/fluxoEngine'
import { enviarPedidoCsat } from '@/lib/csatService'
import { enviarEmail } from '@/lib/notificacoes'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'
import { substituirVariaveis, gerarProtocolo } from '@/lib/variaveisFluxo'
import { FLUXO_SAIU } from '@/types/database'

// Função serverless, não um agendador de verdade — uma pausa longa só
// prende a execução em segundo plano (via after()) sem trazer benefício
// real, e arrisca estourar o tempo máximo da função. 1 min é generoso o
// bastante pra um "espera um instante" dentro do fluxo.
const MAX_PAUSA_SEGUNDOS = 60

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

/** Registra uma nota interna (nó "nota_interna") — nunca sai pro WhatsApp, só aparece no painel pro atendente. */
async function registrarNotaInterna(contaId: string, numero: string, texto: string, estilo: 'info' | 'alerta'): Promise<void> {
  await criarMensagem({
    id: `nota_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    contaId,
    from: 'sistema',
    to: numero,
    text: texto,
    timestamp: Math.floor(Date.now() / 1000),
    tipo: 'nota',
    estiloNota: estilo,
  })
}

/**
 * Executa uma ação do fluxo que NÃO é a última mensagem de texto de um menu
 * (essa continua com tratamento especial pra virar botões/lista — ver
 * abaixo). Cobre todo o resto do pacote "mensageria essencial": template,
 * link, e-mail, nota interna, QR code, etiqueta, protocolo e a solicitação
 * de localização.
 */
async function executarAcao(
  acao: AcaoFluxo,
  contaId: string,
  numero: string,
  metaAccess: { phoneNumberId: string; businessToken: string },
  dados: Record<string, string>,
): Promise<void> {
  switch (acao.tipo) {
    case 'texto': {
      const envio = await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, acao.texto)
      await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, acao.texto, envio)
      return
    }
    case 'localizacao': {
      const envio = await sendLocationRequestMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, acao.texto)
      await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, acao.texto, envio)
      return
    }
    case 'template': {
      const envio = await sendTemplateMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, acao.nome)
      await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, `📋 Template: ${acao.nome}`, envio)
      return
    }
    case 'url': {
      const texto = substituirVariaveis(acao.texto, dados)
      const envio = await sendCtaUrlMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto, acao.url, acao.label)
      await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, texto, envio)
      return
    }
    case 'nota':
      await registrarNotaInterna(contaId, numero, substituirVariaveis(acao.texto, dados), acao.estilo)
      return
    case 'email': {
      const destinatario = substituirVariaveis(acao.destinatario, dados)
      const corpo = substituirVariaveis(acao.corpo, dados)
      const enviado = await enviarEmail({ para: destinatario, assunto: acao.assunto, corpoHtml: `<p>${corpo}</p>` }).catch(() => false)
      await registrarNotaInterna(
        contaId,
        numero,
        enviado ? `✉️ E-mail enviado para ${destinatario}` : `⚠️ Falha ao enviar e-mail para ${destinatario}`,
        enviado ? 'info' : 'alerta',
      )
      return
    }
    case 'qrcode': {
      const conteudo = substituirVariaveis(acao.conteudo, dados)
      try {
        const buffer = await QRCode.toBuffer(conteudo, { type: 'png', width: 512 })
        const { id: mediaId } = await uploadMediaToMeta(metaAccess.phoneNumberId, metaAccess.businessToken, buffer, 'image/png', 'qrcode.png')
        const envio = await sendMediaMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, 'image', mediaId)
        const mensagemId = envio?.messages?.[0]?.id
        if (mensagemId) {
          await criarMensagem({
            id: mensagemId,
            contaId,
            from: metaAccess.phoneNumberId,
            to: numero,
            text: '',
            timestamp: Math.floor(Date.now() / 1000),
            tipo: 'enviada',
            status: 'enviada',
            mediaId,
            mediaType: 'image',
            mediaMimeType: 'image/png',
          })
        }
      } catch (error) {
        console.error('Erro ao gerar/enviar QR code do fluxo:', error)
      }
      return
    }
    case 'etiqueta':
      await adicionarEtiquetaConversa(contaId, numero, acao.valor)
      await registrarNotaInterna(contaId, numero, `🏷️ Etiqueta adicionada: ${acao.valor}`, 'info')
      return
    case 'protocolo': {
      const protocolo = gerarProtocolo()
      await definirProtocoloConversa(contaId, numero, protocolo)
      if (acao.mensagem) {
        const texto = substituirVariaveis(acao.mensagem, { ...dados, protocolo })
        const envio = await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numero, texto)
        await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, texto, envio)
      } else {
        await registrarNotaInterna(contaId, numero, `🔖 Protocolo gerado: ${protocolo}`, 'info')
      }
      return
    }
    case 'variavel':
      await salvarDadoColetado(contaId, numero, acao.chave, substituirVariaveis(acao.valor, dados))
      return
    case 'pausa': {
      const segundos = Math.min(acao.segundos, MAX_PAUSA_SEGUNDOS)
      await new Promise((resolve) => setTimeout(resolve, segundos * 1000))
      return
    }
  }
}

async function persistirEnvio(contaId: string, numero: string, phoneNumberId: string, texto: string, envio: { messages?: { id: string }[] }): Promise<void> {
  const mensagemId = envio?.messages?.[0]?.id
  if (!mensagemId) return
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

  // Se a conversa estava parada num nó "coleta"/"solicitar_localizacao", a
  // resposta que acabou de chegar É o dado sendo coletado — guarda antes de
  // decidir o próximo passo (o motor só decide roteamento, não sabe onde
  // persistir). Atualiza a cópia local também, pra um "condicao_variavel"
  // logo em seguida no mesmo fluxo já enxergar esse valor fresco (o
  // `conversa` foi lido do Firestore ANTES dessa gravação).
  let dadosColetados = conversa?.dadosColetados ?? {}
  if (conversa?.fluxoNoAtualId) {
    const noAtual = encontrarNo(fluxo, conversa.fluxoNoAtualId)
    if ((noAtual?.tipo === 'coleta' || noAtual?.tipo === 'solicitar_localizacao') && noAtual.variavel) {
      await salvarDadoColetado(contaId, numero, noAtual.variavel, textoRecebido)
      dadosColetados = { ...dadosColetados, [noAtual.variavel]: textoRecebido }
    }
  }

  const resultado = conversa?.fluxoNoAtualId
    ? continuarFluxo(fluxo, conversa.fluxoNoAtualId, textoRecebido, new Date(), dadosColetados)
    : iniciarFluxo(fluxo, new Date(), dadosColetados)

  if (resultado.acoes.length > 0) {
    const metaAccessBase = await obterMetaAccess(contaId)
    if (metaAccessBase) {
      // Responde pelo mesmo número em que o cliente escreveu (contas com
      // mais de um número de WhatsApp) — cai pro principal se a conversa não
      // tiver canal salvo ou ele não pertencer mais à conta.
      const metaAccess = { ...metaAccessBase, phoneNumberId: resolverPhoneNumberId(metaAccessBase, conversa?.canalPhoneNumberId) }

      // Última ação de um 'enviar_e_aguardar'/'opcao_invalida' num nó de
      // menu vira botões/lista nativos — as demais (nós automáticos no
      // caminho até o menu) seguem cada uma com seu próprio tipo de envio.
      const noDestino = resultado.acao === 'enviar_e_aguardar' || resultado.acao === 'opcao_invalida' ? encontrarNo(fluxo, resultado.noId) : undefined
      const opcoesInterativas = noDestino?.tipo === 'menu' ? (noDestino.opcoes ?? []).filter((o) => o.rotulo.trim()) : []

      for (let i = 0; i < resultado.acoes.length; i++) {
        const acao = resultado.acoes[i]
        const ehUltimaEInterativa = i === resultado.acoes.length - 1 && acao.tipo === 'texto' && opcoesInterativas.length > 0
        try {
          if (ehUltimaEInterativa && acao.tipo === 'texto') {
            const envio = await enviarMenuInterativo(metaAccess, numero, acao.texto, opcoesInterativas)
            await persistirEnvio(contaId, numero, metaAccess.phoneNumberId, acao.texto, envio)
          } else {
            await executarAcao(acao, contaId, numero, metaAccess, dadosColetados)
            // Uma ação "variavel" nessa mesma passagem já fica visível pras
            // próximas (ex: "definir_variavel" seguido de "enviar_email"
            // referenciando o valor que acabou de ser definido).
            if (acao.tipo === 'variavel') dadosColetados = { ...dadosColetados, [acao.chave]: substituirVariaveis(acao.valor, dadosColetados) }
          }
        } catch (error) {
          console.error('Erro ao executar ação do fluxo de atendimento:', { tipo: acao.tipo, error })
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
