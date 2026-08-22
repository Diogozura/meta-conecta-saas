import { describe, expect, it } from 'vitest'
import { ehTagPrioritaria } from './prioridadeConversa'

describe('ehTagPrioritaria', () => {
  it('reconhece "VIP" em qualquer capitalização', () => {
    expect(ehTagPrioritaria('VIP')).toBe(true)
    expect(ehTagPrioritaria('vip')).toBe(true)
    expect(ehTagPrioritaria('Vip')).toBe(true)
  })

  it('reconhece "prioritário" com ou sem acento', () => {
    expect(ehTagPrioritaria('Prioritário')).toBe(true)
    expect(ehTagPrioritaria('prioritario')).toBe(true)
  })

  it('reconhece a tag mesmo com texto ao redor (ex: "Cliente VIP")', () => {
    expect(ehTagPrioritaria('Cliente VIP')).toBe(true)
  })

  it('não reconhece tags comuns como "Lead" ou "Cliente"', () => {
    expect(ehTagPrioritaria('Lead')).toBe(false)
    expect(ehTagPrioritaria('Cliente')).toBe(false)
    expect(ehTagPrioritaria('Inativo')).toBe(false)
  })

  it('lida com tag ausente sem quebrar', () => {
    expect(ehTagPrioritaria(undefined)).toBe(false)
    expect(ehTagPrioritaria(null)).toBe(false)
    expect(ehTagPrioritaria('')).toBe(false)
  })
})
