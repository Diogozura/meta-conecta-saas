import type { AvaliacaoCsat, Conversa, EventoAtendimento } from '@/types/database'

export type MetricaSetor = {
  setor: string // 'Sem setor' quando a conversa não veio de um nó "encaminhar_humano" com setor definido
  totalAguardando: number
  totalEmAtendimento: number
  esperaMediaMin: number | null
  esperaMaximaMin: number | null
}

/**
 * Fotografia AO VIVO da fila humana, por setor — não é uma série histórica
 * (isso exigiria um log de eventos que o app não mantém hoje), é "como está
 * a fila agora": quantas conversas aguardando/em atendimento em cada setor,
 * e há quanto tempo em média as que estão aguardando já esperam.
 */
export function calcularMetricasPorSetor(conversas: Conversa[], agora: Date = new Date()): MetricaSetor[] {
  const grupos = new Map<string, { aguardando: Conversa[]; emAtendimento: Conversa[] }>()

  for (const c of conversas) {
    if (c.iaAtiva) continue // só nos importa quem está fora da IA (fila humana)
    const setor = c.setor?.trim() || 'Sem setor'
    if (!grupos.has(setor)) grupos.set(setor, { aguardando: [], emAtendimento: [] })
    const grupo = grupos.get(setor)!
    if (c.atendenteId) grupo.emAtendimento.push(c)
    else grupo.aguardando.push(c)
  }

  return [...grupos.entries()]
    .map(([setor, grupo]) => {
      const esperasMin = grupo.aguardando
        .filter((c) => c.dataTransferencia)
        .map((c) => (agora.getTime() - new Date(c.dataTransferencia!).getTime()) / 60000)
      return {
        setor,
        totalAguardando: grupo.aguardando.length,
        totalEmAtendimento: grupo.emAtendimento.length,
        esperaMediaMin: esperasMin.length ? Math.round(esperasMin.reduce((a, b) => a + b, 0) / esperasMin.length) : null,
        esperaMaximaMin: esperasMin.length ? Math.round(Math.max(...esperasMin)) : null,
      }
    })
    .sort((a, b) => b.totalAguardando - a.totalAguardando || a.setor.localeCompare(b.setor))
}

export type MetricaHistoricaSetor = {
  setor: string
  totalTransferencias: number // quantas conversas entraram na fila desse setor no período
  totalAssumidas: number // quantas foram de fato assumidas por alguém
  totalEncerradas: number
  esperaMediaMin: number | null // tempo médio entre "entrou na fila" e "foi assumida"
  atendimentoMedioMin: number | null // tempo médio entre "foi assumida" e "conversa encerrada"
}

/**
 * Métricas HISTÓRICAS por setor, a partir do log de eventos (período
 * arbitrário — normalmente "últimos N dias"). Casa os eventos de cada
 * conversa numa sequência (transferida → assumida → encerrada) pra calcular
 * tempo de espera e tempo de atendimento reais, não só o instantâneo de agora.
 */
export function calcularMetricasHistoricas(eventos: EventoAtendimento[]): MetricaHistoricaSetor[] {
  const ordenados = [...eventos].sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())

  type Grupo = { transferencias: number; assumidas: number; encerradas: number; esperas: number[]; atendimentos: number[] }
  const porSetor = new Map<string, Grupo>()
  function grupo(setor: string): Grupo {
    const key = setor || 'Sem setor'
    if (!porSetor.has(key)) porSetor.set(key, { transferencias: 0, assumidas: 0, encerradas: 0, esperas: [], atendimentos: [] })
    return porSetor.get(key)!
  }

  // Estado por número — pra saber, quando uma "assumida"/"encerrada" chega,
  // a qual "transferida"/"assumida" anterior ela corresponde.
  const estados = new Map<string, { setor: string; transferidaEm: Date | null; assumidaEm: Date | null }>()

  for (const ev of ordenados) {
    const estado = estados.get(ev.numero) ?? { setor: '', transferidaEm: null, assumidaEm: null }
    const criadoEm = new Date(ev.criadoEm)

    if (ev.tipo === 'transferida_humano') {
      estado.setor = ev.setor?.trim() || 'Sem setor'
      estado.transferidaEm = criadoEm
      estado.assumidaEm = null
      grupo(estado.setor).transferencias++
    } else if (ev.tipo === 'assumida') {
      const g = grupo(estado.setor || 'Sem setor')
      g.assumidas++
      if (estado.transferidaEm) g.esperas.push((criadoEm.getTime() - estado.transferidaEm.getTime()) / 60000)
      estado.assumidaEm = criadoEm
    } else if (ev.tipo === 'encerrada') {
      const g = grupo(estado.setor || 'Sem setor')
      g.encerradas++
      if (estado.assumidaEm) g.atendimentos.push((criadoEm.getTime() - estado.assumidaEm.getTime()) / 60000)
      estado.transferidaEm = null
      estado.assumidaEm = null
    }

    estados.set(ev.numero, estado)
  }

  const media = (lista: number[]) => (lista.length ? Math.round(lista.reduce((a, b) => a + b, 0) / lista.length) : null)

  return [...porSetor.entries()]
    .map(([setor, g]) => ({
      setor,
      totalTransferencias: g.transferencias,
      totalAssumidas: g.assumidas,
      totalEncerradas: g.encerradas,
      esperaMediaMin: media(g.esperas),
      atendimentoMedioMin: media(g.atendimentos),
    }))
    .sort((a, b) => b.totalTransferencias - a.totalTransferencias || a.setor.localeCompare(b.setor))
}

export type MetricaCsat = {
  totalRespostas: number
  notaMedia: number | null
  nps: number | null // -100 a 100 — % promotores (9-10) menos % detratores (0-6)
}

/** NPS/CSAT clássico a partir das notas 0-10 coletadas — promotor 9-10, neutro 7-8, detrator 0-6. */
export function calcularCsat(avaliacoes: AvaliacaoCsat[]): MetricaCsat {
  if (avaliacoes.length === 0) return { totalRespostas: 0, notaMedia: null, nps: null }

  const promotores = avaliacoes.filter((a) => a.nota >= 9).length
  const detratores = avaliacoes.filter((a) => a.nota <= 6).length
  const notaMedia = avaliacoes.reduce((soma, a) => soma + a.nota, 0) / avaliacoes.length

  return {
    totalRespostas: avaliacoes.length,
    notaMedia: Math.round(notaMedia * 10) / 10,
    nps: Math.round(((promotores - detratores) / avaliacoes.length) * 100),
  }
}
