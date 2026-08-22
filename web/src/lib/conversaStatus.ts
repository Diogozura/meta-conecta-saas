export type ConversaStatus = 'aberta' | 'em_andamento' | 'encerrada'

export const STATUS_LABELS: Record<ConversaStatus, string> = {
  aberta: 'Aberta',
  em_andamento: 'Em andamento',
  encerrada: 'Encerrada',
}

export type Prioridade = 'normal' | 'alta' | 'urgente'

export const PRIORIDADE_LABELS: Record<Prioridade, string> = {
  normal: 'Normal',
  alta: 'Alta',
  urgente: 'Urgente',
}

const ORDEM_PRIORIDADE: Record<Prioridade, number> = { urgente: 0, alta: 1, normal: 2 }

export type ConversaMeta = {
  status: ConversaStatus
  iaAtiva: boolean
  motivoTransferencia: string | null
  dataTransferencia: string | null
  atendenteId: string | null
  atendenteNome: string | null
  assumidoEm: string | null
  // Departamento atribuído por um nó "encaminhar_humano" do fluxo de
  // atendimento (ex: "Financeiro", "Suporte técnico") — null = fila geral.
  setor: string | null
  // 'alta'/'urgente' furam a ordem de chegada na fila — ver ordenarFilaPorPrioridade.
  prioridade: Prioridade
}

export const CONVERSA_META_PADRAO: ConversaMeta = {
  status: 'em_andamento',
  iaAtiva: true,
  motivoTransferencia: null,
  dataTransferencia: null,
  atendenteId: null,
  atendenteNome: null,
  assumidoEm: null,
  setor: null,
  prioridade: 'normal',
}

/**
 * Ordena a fila de "aguardando humano": maior prioridade primeiro: dentro da
 * mesma prioridade, quem está esperando há mais tempo primeiro (FIFO por
 * tier) — sem `dataTransferencia` (não deveria acontecer pra quem está
 * aguardando, mas por segurança) vai pro fim do próprio tier.
 */
export function ordenarFilaPorPrioridade<T extends { prioridade?: Prioridade; dataTransferencia: string | null }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => {
    const diffPrioridade = ORDEM_PRIORIDADE[a.prioridade ?? 'normal'] - ORDEM_PRIORIDADE[b.prioridade ?? 'normal']
    if (diffPrioridade !== 0) return diffPrioridade
    const ta = a.dataTransferencia ? new Date(a.dataTransferencia).getTime() : Infinity
    const tb = b.dataTransferencia ? new Date(b.dataTransferencia).getTime() : Infinity
    return ta - tb
  })
}

export type FilaConversa = 'ia' | 'aguardando' | 'humano'

/** Onde a conversa está na fila de atendimento, pra filtro e indicador na lista do painel. */
export function filaDaConversa(meta: ConversaMeta): FilaConversa {
  if (meta.iaAtiva) return 'ia'
  return meta.atendenteId ? 'humano' : 'aguardando'
}

/** A partir de quantos minutos esperando um atendente humano a fila acende o alerta visual (SLA) — valor usado pra prioridade 'normal' e como referência geral (ex: média por setor). */
export const SLA_ALERTA_MINUTOS = 15

/** SLA por prioridade — urgente/VIP não pode esperar o mesmo tanto que uma conversa normal. */
export const SLA_POR_PRIORIDADE: Record<Prioridade, number> = {
  urgente: 5,
  alta: 10,
  normal: SLA_ALERTA_MINUTOS,
}

export function slaParaPrioridade(prioridade: Prioridade = 'normal'): number {
  return SLA_POR_PRIORIDADE[prioridade]
}

/** "há 3 min", "há 1h 20min", "há 2 dias" — tempo decorrido desde uma data, em português. */
export function formatEspera(desde: Date, agora: Date = new Date()): string {
  const minutos = Math.max(0, Math.floor((agora.getTime() - desde.getTime()) / 60000))
  if (minutos < 1) return 'agora mesmo'
  if (minutos < 60) return `há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    const minutosRestantes = minutos % 60
    return minutosRestantes > 0 ? `há ${horas}h ${minutosRestantes}min` : `há ${horas}h`
  }
  const dias = Math.floor(horas / 24)
  return `há ${dias} dia${dias > 1 ? 's' : ''}`
}

/** Se uma conversa aguardando humano já estourou o SLA de espera. */
export function esperaExcedeuSla(desde: Date, agora: Date = new Date(), limiteMinutos: number = SLA_ALERTA_MINUTOS): boolean {
  const minutos = (agora.getTime() - desde.getTime()) / 60000
  return minutos >= limiteMinutos
}
