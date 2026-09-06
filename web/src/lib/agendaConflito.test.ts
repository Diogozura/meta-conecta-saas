import { describe, expect, it } from 'vitest'
import { encontrarConflito } from './agendaConflito'

const existentes = [
  { id: 'a', agendadoPara: '2026-06-15T18:00:00.000Z' },
  { id: 'b', agendadoPara: '2026-06-16T09:00:00.000Z' },
]

describe('encontrarConflito', () => {
  it('sem publicações existentes, nunca acha conflito', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:00:00.000Z'), [])).toBeUndefined()
  })

  it('acha conflito no mesmo horário exato', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:00:00.000Z'), existentes)?.id).toBe('a')
  })

  it('acha conflito dentro da janela padrão (15 min)', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:10:00.000Z'), existentes)?.id).toBe('a')
  })

  it('não acha conflito fora da janela padrão', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:20:00.000Z'), existentes)).toBeUndefined()
  })

  it('respeita uma janela customizada', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:20:00.000Z'), existentes, { janelaMinutos: 30 })?.id).toBe('a')
  })

  it('ignora o próprio item ao reagendar ele mesmo', () => {
    expect(encontrarConflito(new Date('2026-06-15T18:00:00.000Z'), existentes, { ignorarId: 'a' })).toBeUndefined()
  })

  it('acha o segundo item quando o horário bate com ele, não com o primeiro', () => {
    expect(encontrarConflito(new Date('2026-06-16T09:05:00.000Z'), existentes)?.id).toBe('b')
  })
})
