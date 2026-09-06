import { describe, expect, it } from 'vitest'
import {
  inputParaDataNoFuso,
  dataParaInputNoFuso,
  inputParaData,
  dataParaInput,
  isoToLocalInput,
  nowParaInput,
} from './fusoHorario'

describe('inputParaDataNoFuso / dataParaInputNoFuso (fuso fixo, sem horário de verão)', () => {
  it('interpreta a hora de parede em São Paulo (UTC-3) e devolve o instante UTC certo', () => {
    const d = inputParaDataNoFuso('2026-06-15T18:00', 'America/Sao_Paulo')
    expect(d.toISOString()).toBe('2026-06-15T21:00:00.000Z')
  })

  it('faz o caminho inverso: de um instante UTC pra hora de parede em São Paulo', () => {
    expect(dataParaInputNoFuso(new Date('2026-06-15T21:00:00.000Z'), 'America/Sao_Paulo')).toBe('2026-06-15T18:00')
  })

  it('ida e volta (round-trip) preserva o valor original', () => {
    const original = '2026-03-10T09:30'
    const data = inputParaDataNoFuso(original, 'America/Sao_Paulo')
    expect(dataParaInputNoFuso(data, 'America/Sao_Paulo')).toBe(original)
  })
})

describe('inputParaDataNoFuso / dataParaInputNoFuso (fuso com horário de verão)', () => {
  it('em janeiro, Nova York está em EST (UTC-5)', () => {
    const d = inputParaDataNoFuso('2026-01-15T12:00', 'America/New_York')
    expect(d.toISOString()).toBe('2026-01-15T17:00:00.000Z')
  })

  it('em julho, Nova York está em EDT (UTC-4) — mesmo horário de parede, instante UTC diferente', () => {
    const d = inputParaDataNoFuso('2026-07-15T12:00', 'America/New_York')
    expect(d.toISOString()).toBe('2026-07-15T16:00:00.000Z')
  })
})

describe('fallback sem fuso configurado (comportamento de sempre, fuso do navegador)', () => {
  it('inputParaData sem timeZone se comporta como `new Date(valor)`', () => {
    expect(inputParaData('2026-05-01T10:00').getTime()).toBe(new Date('2026-05-01T10:00').getTime())
  })

  it('dataParaInput sem timeZone se comporta como isoToLocalInput', () => {
    const iso = '2026-05-01T10:00:00.000Z'
    expect(dataParaInput(iso)).toBe(isoToLocalInput(iso))
  })

  it('nowParaInput sem timeZone devolve uma string no formato do input (16 caracteres, com "T")', () => {
    const valor = nowParaInput()
    expect(valor).toHaveLength(16)
    expect(valor).toContain('T')
  })

  it('nowParaInput COM timeZone também devolve o formato certo', () => {
    const valor = nowParaInput('America/Sao_Paulo')
    expect(valor).toHaveLength(16)
    expect(valor).toContain('T')
  })
})
