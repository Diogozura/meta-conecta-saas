import { describe, expect, it } from 'vitest'
import { buildAddToCalendarLink, calcularHorariosLivres, sanitizeProfissional } from './agendaHelpers'
import { Profissional } from '@/types/database'

function d(iso: string) {
  return new Date(iso)
}

describe('calcularHorariosLivres', () => {
  it('fatia um bloco disponível em slots do tamanho do serviço', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T10:00:00Z') }],
      ocupados: [],
      duracaoMinutos: 30,
      agora: d('2026-01-01T00:00:00Z'),
    })
    expect(slots).toHaveLength(2)
    expect(slots[0]).toEqual({ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T09:30:00Z') })
    expect(slots[1]).toEqual({ inicio: d('2026-01-05T09:30:00Z'), fim: d('2026-01-05T10:00:00Z') })
  })

  it('não gera slot quando a duração não cabe inteira no bloco', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T09:40:00Z') }],
      ocupados: [],
      duracaoMinutos: 30,
      agora: d('2026-01-01T00:00:00Z'),
    })
    expect(slots).toHaveLength(1)
  })

  it('remove os horários ocupados do meio do bloco', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T12:00:00Z') }],
      ocupados: [{ inicio: d('2026-01-05T10:00:00Z'), fim: d('2026-01-05T11:00:00Z') }],
      duracaoMinutos: 60,
      agora: d('2026-01-01T00:00:00Z'),
    })
    expect(slots).toEqual([
      { inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T10:00:00Z') },
      { inicio: d('2026-01-05T11:00:00Z'), fim: d('2026-01-05T12:00:00Z') },
    ])
  })

  it('mescla ocupados sobrepostos antes de subtrair', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T12:00:00Z') }],
      ocupados: [
        { inicio: d('2026-01-05T09:30:00Z'), fim: d('2026-01-05T10:30:00Z') },
        { inicio: d('2026-01-05T10:00:00Z'), fim: d('2026-01-05T11:00:00Z') },
      ],
      duracaoMinutos: 30,
      agora: d('2026-01-01T00:00:00Z'),
    })
    // ocupado efetivo: 09:30–11:00 → só sobra 09:00–09:30 e 11:00–12:00
    expect(slots).toEqual([
      { inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T09:30:00Z') },
      { inicio: d('2026-01-05T11:00:00Z'), fim: d('2026-01-05T11:30:00Z') },
      { inicio: d('2026-01-05T11:30:00Z'), fim: d('2026-01-05T12:00:00Z') },
    ])
  })

  it('nunca gera slot no passado, mesmo que o bloco de disponibilidade já tenha começado', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T12:00:00Z') }],
      ocupados: [],
      duracaoMinutos: 60,
      agora: d('2026-01-05T10:15:00Z'),
    })
    expect(slots[0].inicio).toEqual(d('2026-01-05T10:15:00Z'))
  })

  it('ordena os slots resultantes mesmo com blocos de disponibilidade fora de ordem', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [
        { inicio: d('2026-01-06T09:00:00Z'), fim: d('2026-01-06T10:00:00Z') },
        { inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T10:00:00Z') },
      ],
      ocupados: [],
      duracaoMinutos: 60,
      agora: d('2026-01-01T00:00:00Z'),
    })
    expect(slots.map((s) => s.inicio.toISOString())).toEqual([
      '2026-01-05T09:00:00.000Z',
      '2026-01-06T09:00:00.000Z',
    ])
  })

  it('retorna lista vazia quando o serviço não cabe em nenhum bloco', () => {
    const slots = calcularHorariosLivres({
      disponibilidades: [{ inicio: d('2026-01-05T09:00:00Z'), fim: d('2026-01-05T09:10:00Z') }],
      ocupados: [],
      duracaoMinutos: 30,
      agora: d('2026-01-01T00:00:00Z'),
    })
    expect(slots).toEqual([])
  })
})

describe('buildAddToCalendarLink', () => {
  it('monta a URL do Google Calendar com datas no formato UTC compacto', () => {
    const url = buildAddToCalendarLink({
      titulo: 'Corte de cabelo',
      inicio: d('2026-01-05T09:00:00Z'),
      fim: d('2026-01-05T09:30:00Z'),
    })
    const parsed = new URL(url)
    expect(parsed.origin + parsed.pathname).toBe('https://calendar.google.com/calendar/render')
    expect(parsed.searchParams.get('text')).toBe('Corte de cabelo')
    expect(parsed.searchParams.get('dates')).toBe('20260105T090000Z/20260105T093000Z')
    expect(parsed.searchParams.has('details')).toBe(false)
  })

  it('inclui a descrição só quando ela é passada', () => {
    const url = buildAddToCalendarLink({
      titulo: 'Corte',
      descricao: 'com Maria',
      inicio: d('2026-01-05T09:00:00Z'),
      fim: d('2026-01-05T09:30:00Z'),
    })
    expect(new URL(url).searchParams.get('details')).toBe('com Maria')
  })
})

describe('sanitizeProfissional', () => {
  const base: Profissional = {
    id: 'p1',
    contaId: 'c1',
    nome: 'Maria',
    ativo: true,
    dataCadastro: new Date('2026-01-01'),
    dataAtualizacao: new Date('2026-01-01'),
  }

  it('remove o refreshTokenEnc do google, mantendo o resto', () => {
    const result = sanitizeProfissional({
      ...base,
      google: { conectado: true, calendarId: 'primary', refreshTokenEnc: 'segredo', email: 'maria@example.com' },
    })
    expect(result.google).toEqual({ conectado: true, calendarId: 'primary', email: 'maria@example.com' })
    expect(result.google).not.toHaveProperty('refreshTokenEnc')
  })

  it('não quebra quando o profissional não tem google conectado', () => {
    const result = sanitizeProfissional(base)
    expect(result.google).toBeUndefined()
  })
})
