import type { Fluxo, FluxoHorario, FluxoNode } from '@/types/database'
import { avaliarCondicao } from '@/lib/variaveisFluxo'

type FluxoGrafo = Pick<Fluxo, 'nodes' | 'edges'>

/**
 * Um passo concreto que o fluxo decidiu dar — o motor só monta essa lista
 * (pura, sem I/O); quem executa de verdade (enviar pro WhatsApp, mandar
 * e-mail, gravar no Firestore) é lib/fluxoService.ts.
 */
export type AcaoFluxo =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'template'; nome: string }
  | { tipo: 'url'; texto: string; url: string; label: string }
  | { tipo: 'nota'; texto: string; estilo: 'info' | 'alerta' }
  | { tipo: 'email'; destinatario: string; assunto: string; corpo: string }
  | { tipo: 'qrcode'; conteudo: string }
  | { tipo: 'etiqueta'; valor: string }
  | { tipo: 'protocolo'; mensagem: string | null }
  | { tipo: 'localizacao'; texto: string }
  | { tipo: 'variavel'; chave: string; valor: string }
  | { tipo: 'pausa'; segundos: number }

export type FluxoResultado =
  // Percorreu nós automáticos (mensagem, enviar_template, etc.) até parar
  // num 'menu'/'coleta'/'solicitar_localizacao' — executa as ações
  // acumuladas e espera a próxima mensagem do cliente.
  | { acao: 'enviar_e_aguardar'; acoes: AcaoFluxo[]; noId: string }
  // Resposta do cliente não bateu com nenhuma opção do menu atual — repete o menu.
  | { acao: 'opcao_invalida'; acoes: AcaoFluxo[]; noId: string }
  // Chegou num nó 'encaminhar_ia' — a partir daqui quem responde é o agente de IA de sempre.
  | { acao: 'encaminhar_ia'; acoes: AcaoFluxo[] }
  // Chegou num nó 'encaminhar_humano' — entra na fila de atendimento humano (com setor, se definido).
  | { acao: 'encaminhar_humano'; acoes: AcaoFluxo[]; setor?: string; motivo?: string }
  // Chegou num nó 'fim' (ou o fluxo terminou sem encaminhar a lugar nenhum) — encerra a conversa.
  | { acao: 'encerrar'; acoes: AcaoFluxo[] }

export function encontrarNo(fluxo: FluxoGrafo, id: string): FluxoNode | undefined {
  return fluxo.nodes.find((n) => n.id === id)
}

function proximaAresta(fluxo: FluxoGrafo, origemId: string, handleId?: string) {
  return fluxo.edges.find((e) => e.origem === origemId && (handleId === undefined || e.opcaoId === handleId))
}

function paraMinutosDoDia(hhmm: string): number {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10))
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}

/** Dia da semana (0=domingo) e minutos desde meia-noite, sempre no fuso de Brasília — independe do fuso do servidor. */
function partesEmSaoPaulo(agora: Date): { diaSemana: number; minutosDoDia: number } {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(agora)
  const mapa = Object.fromEntries(partes.map((p) => [p.type, p.value])) as Record<string, string>
  const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const diaSemana = DIAS[mapa.weekday] ?? agora.getDay()
  let hora = parseInt(mapa.hour, 10)
  if (hora === 24) hora = 0 // alguns runtimes ICU representam meia-noite como "24:00" com hour12:false
  const minuto = parseInt(mapa.minute, 10)
  return { diaSemana, minutosDoDia: hora * 60 + minuto }
}

/** Se `agora` cai dentro da janela configurada (dia da semana + intervalo de horário), no fuso de Brasília. */
export function estaDentroDoHorario(horario: FluxoHorario, agora: Date = new Date()): boolean {
  const { diaSemana, minutosDoDia } = partesEmSaoPaulo(agora)
  if (!horario.diasSemana[diaSemana]) return false
  const inicio = paraMinutosDoDia(horario.horaInicio)
  const fim = paraMinutosDoDia(horario.horaFim)
  if (fim <= inicio) return false // configuração inválida (fim antes do início) — trata como sempre fechado, não como sempre aberto
  return minutosDoDia >= inicio && minutosDoDia < fim
}

/** Percorre o fluxo a partir de um nó, acumulando as ações dos nós automáticos no caminho, até parar num nó que precisa de ação (menu/coleta/localização/ia/humano/fim). `dados` é Conversa.dadosColetados — lido por 'condicao_variavel' e pelas ações que a essa altura já foram acumuladas nessa mesma passagem (ver 'definir_variavel'). */
function avancar(fluxo: FluxoGrafo, noId: string, acoesAcumuladas: AcaoFluxo[], visitados: Set<string>, agora: Date, dados: Record<string, string>): FluxoResultado {
  if (visitados.has(noId)) {
    // Ciclo no fluxo (erro de montagem) — não trava em loop infinito, cai pra IA.
    return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }
  }
  visitados.add(noId)

  const no = encontrarNo(fluxo, noId)
  if (!no) return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }

  // Passo automático genérico: acumula uma ação (se o nó estiver preenchido
  // o bastante pra gerar uma) e segue direto pra próxima aresta — mesmo
  // formato de 'mensagem' e todo o pacote "mensageria essencial".
  function passoAutomatico(acaoNova: AcaoFluxo | null, dadosAtualizados: Record<string, string> = dados): FluxoResultado {
    const proximas = acaoNova ? [...acoesAcumuladas, acaoNova] : acoesAcumuladas
    const aresta = proximaAresta(fluxo, no!.id)
    if (!aresta) return { acao: 'encerrar', acoes: proximas }
    return avancar(fluxo, aresta.destino, proximas, visitados, agora, dadosAtualizados)
  }

  switch (no.tipo) {
    case 'inicio': {
      const aresta = proximaAresta(fluxo, no.id)
      if (!aresta) return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }
      return avancar(fluxo, aresta.destino, acoesAcumuladas, visitados, agora, dados)
    }
    case 'mensagem':
      return passoAutomatico(no.texto ? { tipo: 'texto', texto: no.texto } : null)
    case 'enviar_template':
      return passoAutomatico(no.templateNome ? { tipo: 'template', nome: no.templateNome } : null)
    case 'enviar_url':
      return passoAutomatico(no.texto && no.url ? { tipo: 'url', texto: no.texto, url: no.url, label: no.botaoLabel || 'Abrir link' } : null)
    case 'enviar_email':
      return passoAutomatico(
        no.texto && no.emailDestinatario
          ? { tipo: 'email', destinatario: no.emailDestinatario, assunto: no.emailAssunto || 'Mensagem do fluxo de atendimento', corpo: no.texto }
          : null
      )
    case 'nota_interna':
      return passoAutomatico(no.texto ? { tipo: 'nota', texto: no.texto, estilo: no.estiloNota ?? 'info' } : null)
    case 'gerar_qrcode':
      return passoAutomatico(no.texto ? { tipo: 'qrcode', conteudo: no.texto } : null)
    case 'adicionar_etiqueta':
      return passoAutomatico(no.etiqueta ? { tipo: 'etiqueta', valor: no.etiqueta } : null)
    case 'gerar_protocolo':
      return passoAutomatico({ tipo: 'protocolo', mensagem: no.texto || null })
    case 'definir_variavel': {
      if (!no.variavel) return passoAutomatico(null)
      const valor = no.texto ?? ''
      // Atualiza `dados` já nessa mesma passagem — um "condicao_variavel"
      // logo depois consegue ler o valor que acabou de ser definido.
      return passoAutomatico({ tipo: 'variavel', chave: no.variavel, valor }, { ...dados, [no.variavel]: valor })
    }
    case 'pausar':
      return passoAutomatico(no.pausaSegundos && no.pausaSegundos > 0 ? { tipo: 'pausa', segundos: no.pausaSegundos } : null)
    case 'condicao_variavel': {
      const resultado = no.operador ? avaliarCondicao(dados[no.variavel ?? ''], no.operador, no.valorComparacao) : false
      const aresta = proximaAresta(fluxo, no.id, resultado ? 'verdadeiro' : 'falso')
      if (!aresta) return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }
      return avancar(fluxo, aresta.destino, acoesAcumuladas, visitados, agora, dados)
    }
    case 'menu':
    case 'coleta':
      return { acao: 'enviar_e_aguardar', acoes: no.texto ? [...acoesAcumuladas, { tipo: 'texto', texto: no.texto }] : acoesAcumuladas, noId: no.id }
    case 'solicitar_localizacao':
      return { acao: 'enviar_e_aguardar', acoes: no.texto ? [...acoesAcumuladas, { tipo: 'localizacao', texto: no.texto }] : acoesAcumuladas, noId: no.id }
    case 'horario': {
      // Sem configuração válida, trata como "fora do horário" (mais seguro
      // que atender fora de hora por engano num nó mal preenchido).
      const dentro = no.horario ? estaDentroDoHorario(no.horario, agora) : false
      const aresta = proximaAresta(fluxo, no.id, dentro ? 'dentro' : 'fora')
      if (!aresta) return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }
      return avancar(fluxo, aresta.destino, acoesAcumuladas, visitados, agora, dados)
    }
    case 'encaminhar_ia':
      return { acao: 'encaminhar_ia', acoes: acoesAcumuladas }
    case 'encaminhar_humano':
      return { acao: 'encaminhar_humano', acoes: acoesAcumuladas, setor: no.setor, motivo: no.motivo }
    case 'fim':
      return { acao: 'encerrar', acoes: acoesAcumuladas }
  }
}

/** Início de uma conversa nova — entra pelo nó 'inicio' do fluxo. `agora` é injetável pra testes; em produção é o instante real. `dadosColetados` é Conversa.dadosColetados, pros nós 'condicao_variavel' já existentes num fluxo reaberto. */
export function iniciarFluxo(fluxo: FluxoGrafo, agora: Date = new Date(), dadosColetados: Record<string, string> = {}): FluxoResultado {
  const inicio = fluxo.nodes.find((n) => n.tipo === 'inicio')
  if (!inicio) return { acao: 'encaminhar_ia', acoes: [] }
  return avancar(fluxo, inicio.id, [], new Set(), agora, dadosColetados)
}

/** Conversa já estava parada num 'menu', 'coleta' ou 'solicitar_localizacao' (noAtualId) — decide o próximo passo pela resposta do cliente. */
export function continuarFluxo(fluxo: FluxoGrafo, noAtualId: string, respostaTexto: string, agora: Date = new Date(), dadosColetados: Record<string, string> = {}): FluxoResultado {
  const noAtual = encontrarNo(fluxo, noAtualId)
  if (!noAtual) return iniciarFluxo(fluxo, agora, dadosColetados)

  if (noAtual.tipo === 'coleta' || noAtual.tipo === 'solicitar_localizacao') {
    // Aceita qualquer texto como resposta — quem guarda o valor em
    // Conversa.dadosColetados é o chamador (fluxoService), que sabe o
    // `variavel` do nó; o motor só decide o próximo passo.
    const aresta = proximaAresta(fluxo, noAtual.id)
    if (!aresta) return { acao: 'encerrar', acoes: [] }
    return avancar(fluxo, aresta.destino, [], new Set(), agora, dadosColetados)
  }

  if (noAtual.tipo !== 'menu') {
    // Estado inconsistente (nó removido/mudou de tipo desde que a conversa parou nele) — reinicia do zero.
    return iniciarFluxo(fluxo, agora, dadosColetados)
  }

  const respostaNormalizada = respostaTexto.trim().toLowerCase()
  const opcaoEscolhida = noAtual.opcoes?.find((o) => o.rotulo.trim().toLowerCase() === respostaNormalizada)
  const aresta = opcaoEscolhida ? fluxo.edges.find((e) => e.origem === noAtual.id && e.opcaoId === opcaoEscolhida.id) : undefined

  if (!opcaoEscolhida || !aresta) {
    return { acao: 'opcao_invalida', acoes: noAtual.texto ? [{ tipo: 'texto', texto: noAtual.texto }] : [], noId: noAtual.id }
  }

  return avancar(fluxo, aresta.destino, [], new Set(), agora, dadosColetados)
}
