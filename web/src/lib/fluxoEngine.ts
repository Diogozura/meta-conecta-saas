import type { Fluxo, FluxoHorario, FluxoNode } from '@/types/database'

type FluxoGrafo = Pick<Fluxo, 'nodes' | 'edges'>

export type FluxoResultado =
  // Percorreu nós automáticos (mensagem) até parar num 'menu' — envia as
  // mensagens acumuladas e espera a próxima mensagem do cliente pra decidir a opção.
  | { acao: 'enviar_e_aguardar'; mensagens: string[]; noId: string }
  // Resposta do cliente não bateu com nenhuma opção do menu atual — repete o menu.
  | { acao: 'opcao_invalida'; mensagens: string[]; noId: string }
  // Chegou num nó 'encaminhar_ia' — a partir daqui quem responde é o agente de IA de sempre.
  | { acao: 'encaminhar_ia'; mensagens: string[] }
  // Chegou num nó 'encaminhar_humano' — entra na fila de atendimento humano (com setor, se definido).
  | { acao: 'encaminhar_humano'; mensagens: string[]; setor?: string; motivo?: string }
  // Chegou num nó 'fim' (ou o fluxo terminou sem encaminhar a lugar nenhum) — encerra a conversa.
  | { acao: 'encerrar'; mensagens: string[] }

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

/** Percorre o fluxo a partir de um nó, acumulando o texto dos nós 'mensagem' no caminho, até parar num nó que precisa de ação (menu/ia/humano/fim). */
function avancar(fluxo: FluxoGrafo, noId: string, mensagensAcumuladas: string[], visitados: Set<string>, agora: Date): FluxoResultado {
  if (visitados.has(noId)) {
    // Ciclo no fluxo (erro de montagem) — não trava em loop infinito, cai pra IA.
    return { acao: 'encaminhar_ia', mensagens: mensagensAcumuladas }
  }
  visitados.add(noId)

  const no = encontrarNo(fluxo, noId)
  if (!no) return { acao: 'encaminhar_ia', mensagens: mensagensAcumuladas }

  switch (no.tipo) {
    case 'inicio': {
      const aresta = proximaAresta(fluxo, no.id)
      if (!aresta) return { acao: 'encaminhar_ia', mensagens: mensagensAcumuladas }
      return avancar(fluxo, aresta.destino, mensagensAcumuladas, visitados, agora)
    }
    case 'mensagem': {
      const proximas = no.texto ? [...mensagensAcumuladas, no.texto] : mensagensAcumuladas
      const aresta = proximaAresta(fluxo, no.id)
      if (!aresta) return { acao: 'encerrar', mensagens: proximas }
      return avancar(fluxo, aresta.destino, proximas, visitados, agora)
    }
    case 'menu':
    case 'coleta':
      return { acao: 'enviar_e_aguardar', mensagens: no.texto ? [...mensagensAcumuladas, no.texto] : mensagensAcumuladas, noId: no.id }
    case 'horario': {
      // Sem configuração válida, trata como "fora do horário" (mais seguro
      // que atender fora de hora por engano num nó mal preenchido).
      const dentro = no.horario ? estaDentroDoHorario(no.horario, agora) : false
      const aresta = proximaAresta(fluxo, no.id, dentro ? 'dentro' : 'fora')
      if (!aresta) return { acao: 'encaminhar_ia', mensagens: mensagensAcumuladas }
      return avancar(fluxo, aresta.destino, mensagensAcumuladas, visitados, agora)
    }
    case 'encaminhar_ia':
      return { acao: 'encaminhar_ia', mensagens: mensagensAcumuladas }
    case 'encaminhar_humano':
      return { acao: 'encaminhar_humano', mensagens: mensagensAcumuladas, setor: no.setor, motivo: no.motivo }
    case 'fim':
      return { acao: 'encerrar', mensagens: mensagensAcumuladas }
  }
}

/** Início de uma conversa nova — entra pelo nó 'inicio' do fluxo. `agora` é injetável pra testes; em produção é o instante real. */
export function iniciarFluxo(fluxo: FluxoGrafo, agora: Date = new Date()): FluxoResultado {
  const inicio = fluxo.nodes.find((n) => n.tipo === 'inicio')
  if (!inicio) return { acao: 'encaminhar_ia', mensagens: [] }
  return avancar(fluxo, inicio.id, [], new Set(), agora)
}

/** Conversa já estava parada num 'menu' ou 'coleta' (noAtualId) — decide o próximo passo pela resposta do cliente. */
export function continuarFluxo(fluxo: FluxoGrafo, noAtualId: string, respostaTexto: string, agora: Date = new Date()): FluxoResultado {
  const noAtual = encontrarNo(fluxo, noAtualId)
  if (!noAtual) return iniciarFluxo(fluxo, agora)

  if (noAtual.tipo === 'coleta') {
    // Aceita qualquer texto como resposta — quem guarda o valor em
    // Conversa.dadosColetados é o chamador (fluxoService), que sabe o
    // `variavel` do nó; o motor só decide o próximo passo.
    const aresta = proximaAresta(fluxo, noAtual.id)
    if (!aresta) return { acao: 'encerrar', mensagens: [] }
    return avancar(fluxo, aresta.destino, [], new Set(), agora)
  }

  if (noAtual.tipo !== 'menu') {
    // Estado inconsistente (nó removido/mudou de tipo desde que a conversa parou nele) — reinicia do zero.
    return iniciarFluxo(fluxo, agora)
  }

  const respostaNormalizada = respostaTexto.trim().toLowerCase()
  const opcaoEscolhida = noAtual.opcoes?.find((o) => o.rotulo.trim().toLowerCase() === respostaNormalizada)
  const aresta = opcaoEscolhida ? fluxo.edges.find((e) => e.origem === noAtual.id && e.opcaoId === opcaoEscolhida.id) : undefined

  if (!opcaoEscolhida || !aresta) {
    return { acao: 'opcao_invalida', mensagens: noAtual.texto ? [noAtual.texto] : [], noId: noAtual.id }
  }

  return avancar(fluxo, aresta.destino, [], new Set(), agora)
}
