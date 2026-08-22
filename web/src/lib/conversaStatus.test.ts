import { describe, expect, it } from 'vitest'
import { CONVERSA_META_PADRAO, esperaExcedeuSla, filaDaConversa, formatEspera, ordenarFilaPorPrioridade, SLA_ALERTA_MINUTOS } from './conversaStatus'

describe('filaDaConversa', () => {
  it('é "ia" quando a IA está ativa, mesmo que haja atendente registrado de uma reivindicação anterior', () => {
    expect(filaDaConversa({ ...CONVERSA_META_PADRAO, iaAtiva: true, atendenteId: 'u1' })).toBe('ia')
  })

  it('é "aguardando" quando a IA está desativada e ninguém assumiu', () => {
    expect(filaDaConversa({ ...CONVERSA_META_PADRAO, iaAtiva: false, atendenteId: null })).toBe('aguardando')
  })

  it('é "humano" quando a IA está desativada e um atendente assumiu', () => {
    expect(filaDaConversa({ ...CONVERSA_META_PADRAO, iaAtiva: false, atendenteId: 'u1', atendenteNome: 'Ana' })).toBe('humano')
  })
})

describe('formatEspera', () => {
  const agora = new Date('2026-08-20T12:00:00Z')

  it('mostra "agora mesmo" pra menos de 1 minuto', () => {
    expect(formatEspera(new Date('2026-08-20T11:59:30Z'), agora)).toBe('agora mesmo')
  })

  it('mostra minutos quando é menos de 1 hora', () => {
    expect(formatEspera(new Date('2026-08-20T11:45:00Z'), agora)).toBe('há 15 min')
  })

  it('mostra horas e minutos quando é menos de 1 dia', () => {
    expect(formatEspera(new Date('2026-08-20T10:20:00Z'), agora)).toBe('há 1h 40min')
  })

  it('omite os minutos quando são exatamente 0', () => {
    expect(formatEspera(new Date('2026-08-20T10:00:00Z'), agora)).toBe('há 2h')
  })

  it('mostra dias (singular e plural) quando passa de 24h', () => {
    expect(formatEspera(new Date('2026-08-19T12:00:00Z'), agora)).toBe('há 1 dia')
    expect(formatEspera(new Date('2026-08-17T12:00:00Z'), agora)).toBe('há 3 dias')
  })

  it('nunca retorna tempo negativo, mesmo com relógios levemente dessincronizados', () => {
    expect(formatEspera(new Date('2026-08-20T12:00:05Z'), agora)).toBe('agora mesmo')
  })
})

describe('esperaExcedeuSla', () => {
  const agora = new Date('2026-08-20T12:00:00Z')

  it('não excede antes do limite padrão', () => {
    const desde = new Date(agora.getTime() - (SLA_ALERTA_MINUTOS - 1) * 60000)
    expect(esperaExcedeuSla(desde, agora)).toBe(false)
  })

  it('excede exatamente no limite padrão', () => {
    const desde = new Date(agora.getTime() - SLA_ALERTA_MINUTOS * 60000)
    expect(esperaExcedeuSla(desde, agora)).toBe(true)
  })

  it('aceita um limite customizado', () => {
    const desde = new Date(agora.getTime() - 4 * 60000)
    expect(esperaExcedeuSla(desde, agora, 5)).toBe(false)
    expect(esperaExcedeuSla(desde, agora, 3)).toBe(true)
  })
})

describe('ordenarFilaPorPrioridade', () => {
  it('coloca urgente antes de alta, e alta antes de normal', () => {
    const itens = [
      { id: 'normal', prioridade: 'normal' as const, dataTransferencia: '2026-08-20T10:00:00Z' },
      { id: 'urgente', prioridade: 'urgente' as const, dataTransferencia: '2026-08-20T10:00:00Z' },
      { id: 'alta', prioridade: 'alta' as const, dataTransferencia: '2026-08-20T10:00:00Z' },
    ]
    expect(ordenarFilaPorPrioridade(itens).map((i) => i.id)).toEqual(['urgente', 'alta', 'normal'])
  })

  it('dentro da mesma prioridade, ordena por quem está esperando há mais tempo (mais antigo primeiro)', () => {
    const itens = [
      { id: 'recente', prioridade: 'normal' as const, dataTransferencia: '2026-08-20T11:00:00Z' },
      { id: 'antigo', prioridade: 'normal' as const, dataTransferencia: '2026-08-20T09:00:00Z' },
    ]
    expect(ordenarFilaPorPrioridade(itens).map((i) => i.id)).toEqual(['antigo', 'recente'])
  })

  it('prioridade sempre vence tempo de espera — urgente recém-chegado passa na frente de normal esperando há horas', () => {
    const itens = [
      { id: 'normal-esperando', prioridade: 'normal' as const, dataTransferencia: '2026-08-20T06:00:00Z' },
      { id: 'urgente-recente', prioridade: 'urgente' as const, dataTransferencia: '2026-08-20T11:59:00Z' },
    ]
    expect(ordenarFilaPorPrioridade(itens).map((i) => i.id)).toEqual(['urgente-recente', 'normal-esperando'])
  })

  it('trata prioridade ausente como "normal" e não muta o array original', () => {
    const original = [{ id: 'a', dataTransferencia: null }, { id: 'b', prioridade: 'urgente' as const, dataTransferencia: null }]
    const resultado = ordenarFilaPorPrioridade(original)
    expect(resultado.map((i) => i.id)).toEqual(['b', 'a'])
    expect(original.map((i) => i.id)).toEqual(['a', 'b'])
  })
})
