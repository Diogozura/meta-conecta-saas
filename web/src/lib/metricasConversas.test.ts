import { describe, expect, it } from 'vitest'
import { calcularCsat, calcularMetricasHistoricas, calcularMetricasPorSetor } from './metricasConversas'
import type { AvaliacaoCsat, Conversa, EventoAtendimento } from '@/types/database'

const AGORA = new Date('2026-08-20T12:00:00Z')

function conversa(partial: Partial<Conversa> & Pick<Conversa, 'numero'>): Conversa {
  return { iaAtiva: false, ...partial }
}

describe('calcularMetricasPorSetor', () => {
  it('ignora conversas com a IA ativa (não fazem parte da fila humana)', () => {
    const resultado = calcularMetricasPorSetor([conversa({ numero: '1', iaAtiva: true, setor: 'Financeiro' })], AGORA)
    expect(resultado).toEqual([])
  })

  it('agrupa por setor, separando aguardando de em atendimento', () => {
    const conversas: Conversa[] = [
      conversa({ numero: '1', setor: 'Financeiro' }), // aguardando
      conversa({ numero: '2', setor: 'Financeiro', atendenteId: 'u1', atendenteNome: 'Ana' }), // em atendimento
      conversa({ numero: '3', setor: 'Suporte técnico' }), // aguardando
    ]
    const resultado = calcularMetricasPorSetor(conversas, AGORA)
    const financeiro = resultado.find((m) => m.setor === 'Financeiro')
    const suporte = resultado.find((m) => m.setor === 'Suporte técnico')
    expect(financeiro?.totalAguardando).toBe(1)
    expect(financeiro?.totalEmAtendimento).toBe(1)
    expect(suporte?.totalAguardando).toBe(1)
    expect(suporte?.totalEmAtendimento).toBe(0)
  })

  it('agrupa conversas sem setor definido em "Sem setor"', () => {
    const resultado = calcularMetricasPorSetor([conversa({ numero: '1' })], AGORA)
    expect(resultado).toEqual([
      { setor: 'Sem setor', totalAguardando: 1, totalEmAtendimento: 0, esperaMediaMin: null, esperaMaximaMin: null },
    ])
  })

  it('calcula a espera média e máxima em minutos, só das conversas aguardando (não das já em atendimento)', () => {
    const conversas: Conversa[] = [
      conversa({ numero: '1', setor: 'Vendas', dataTransferencia: new Date('2026-08-20T11:50:00Z') }), // 10 min
      conversa({ numero: '2', setor: 'Vendas', dataTransferencia: new Date('2026-08-20T11:40:00Z') }), // 20 min
      conversa({ numero: '3', setor: 'Vendas', atendenteId: 'u1', dataTransferencia: new Date('2026-08-20T10:00:00Z') }), // em atendimento — não entra na média
    ]
    const resultado = calcularMetricasPorSetor(conversas, AGORA)
    const vendas = resultado.find((m) => m.setor === 'Vendas')
    expect(vendas?.esperaMediaMin).toBe(15)
    expect(vendas?.esperaMaximaMin).toBe(20)
  })

  it('retorna espera nula quando nenhuma conversa aguardando tem dataTransferencia', () => {
    const resultado = calcularMetricasPorSetor([conversa({ numero: '1', setor: 'Vendas' })], AGORA)
    expect(resultado[0].esperaMediaMin).toBeNull()
    expect(resultado[0].esperaMaximaMin).toBeNull()
  })

  it('ordena por total aguardando (maior primeiro), desempatando por nome do setor', () => {
    const conversas: Conversa[] = [
      conversa({ numero: '1', setor: 'B' }),
      conversa({ numero: '2', setor: 'A' }),
      conversa({ numero: '3', setor: 'A' }),
    ]
    const resultado = calcularMetricasPorSetor(conversas, AGORA)
    expect(resultado.map((m) => m.setor)).toEqual(['A', 'B'])
  })
})

function evento(partial: Partial<EventoAtendimento> & Pick<EventoAtendimento, 'numero' | 'tipo' | 'criadoEm'>): EventoAtendimento {
  return { id: `${partial.numero}-${partial.tipo}-${partial.criadoEm.toISOString()}`, ...partial }
}

describe('calcularMetricasHistoricas', () => {
  it('conta transferências, assumidas e encerradas por setor, e casa os pares certos pra calcular tempos', () => {
    const eventos: EventoAtendimento[] = [
      evento({ numero: '1', tipo: 'transferida_humano', setor: 'Financeiro', criadoEm: new Date('2026-08-20T10:00:00Z') }),
      evento({ numero: '1', tipo: 'assumida', atendenteNome: 'Ana', criadoEm: new Date('2026-08-20T10:10:00Z') }), // 10 min de espera
      evento({ numero: '1', tipo: 'encerrada', criadoEm: new Date('2026-08-20T10:40:00Z') }), // 30 min de atendimento
    ]
    const resultado = calcularMetricasHistoricas(eventos)
    expect(resultado).toEqual([
      { setor: 'Financeiro', totalTransferencias: 1, totalAssumidas: 1, totalEncerradas: 1, esperaMediaMin: 10, atendimentoMedioMin: 30 },
    ])
  })

  it('agrupa conversas sem setor em "Sem setor"', () => {
    const eventos: EventoAtendimento[] = [evento({ numero: '1', tipo: 'transferida_humano', setor: null, criadoEm: new Date('2026-08-20T10:00:00Z') })]
    expect(calcularMetricasHistoricas(eventos)[0].setor).toBe('Sem setor')
  })

  it('não calcula espera se a conversa foi assumida sem nunca ter sido transferida (estado incompleto/fora da janela)', () => {
    const eventos: EventoAtendimento[] = [evento({ numero: '1', tipo: 'assumida', criadoEm: new Date('2026-08-20T10:00:00Z') })]
    const resultado = calcularMetricasHistoricas(eventos)
    expect(resultado[0].esperaMediaMin).toBeNull()
    expect(resultado[0].totalAssumidas).toBe(1)
  })

  it('processa duas conversas diferentes do mesmo setor sem misturar os pares de cada uma', () => {
    const eventos: EventoAtendimento[] = [
      evento({ numero: '1', tipo: 'transferida_humano', setor: 'Vendas', criadoEm: new Date('2026-08-20T10:00:00Z') }),
      evento({ numero: '2', tipo: 'transferida_humano', setor: 'Vendas', criadoEm: new Date('2026-08-20T10:05:00Z') }),
      evento({ numero: '1', tipo: 'assumida', criadoEm: new Date('2026-08-20T10:20:00Z') }), // 20 min
      evento({ numero: '2', tipo: 'assumida', criadoEm: new Date('2026-08-20T10:10:00Z') }), // 5 min
    ]
    const resultado = calcularMetricasHistoricas(eventos)
    expect(resultado[0].esperaMediaMin).toBe(Math.round((20 + 5) / 2))
  })

  it('ordena por total de transferências (maior primeiro)', () => {
    const eventos: EventoAtendimento[] = [
      evento({ numero: '1', tipo: 'transferida_humano', setor: 'B', criadoEm: new Date('2026-08-20T10:00:00Z') }),
      evento({ numero: '2', tipo: 'transferida_humano', setor: 'A', criadoEm: new Date('2026-08-20T10:00:00Z') }),
      evento({ numero: '3', tipo: 'transferida_humano', setor: 'A', criadoEm: new Date('2026-08-20T10:01:00Z') }),
    ]
    expect(calcularMetricasHistoricas(eventos).map((m) => m.setor)).toEqual(['A', 'B'])
  })

  it('retorna lista vazia pra nenhum evento', () => {
    expect(calcularMetricasHistoricas([])).toEqual([])
  })
})

function avaliacao(nota: number): AvaliacaoCsat {
  return { id: `${nota}-${Math.random()}`, numero: '1', nota, criadoEm: new Date() }
}

describe('calcularCsat', () => {
  it('retorna nulo pra lista vazia', () => {
    expect(calcularCsat([])).toEqual({ totalRespostas: 0, notaMedia: null, nps: null })
  })

  it('classifica promotores (9-10) e detratores (0-6), ignorando neutros (7-8) no NPS', () => {
    const avaliacoes = [avaliacao(10), avaliacao(9), avaliacao(8), avaliacao(7), avaliacao(0)]
    const resultado = calcularCsat(avaliacoes)
    // 2 promotores, 1 detrator, de 5 respostas → (2-1)/5 = 20%
    expect(resultado.nps).toBe(20)
    expect(resultado.totalRespostas).toBe(5)
  })

  it('calcula a nota média arredondada em 1 casa decimal', () => {
    const resultado = calcularCsat([avaliacao(10), avaliacao(9), avaliacao(8)])
    expect(resultado.notaMedia).toBe(9)
  })

  it('NPS pode ser negativo quando há mais detratores que promotores', () => {
    const resultado = calcularCsat([avaliacao(0), avaliacao(1), avaliacao(10)])
    // 1 promotor, 2 detratores → (1-2)/3 = -33%
    expect(resultado.nps).toBe(-33)
  })

  it('NPS é 100 quando todo mundo é promotor', () => {
    expect(calcularCsat([avaliacao(9), avaliacao(10)]).nps).toBe(100)
  })
})
