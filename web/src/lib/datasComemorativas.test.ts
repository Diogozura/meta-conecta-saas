import { describe, expect, it } from 'vitest'
import { datasComemorativasDoDia } from './datasComemorativas'

describe('datasComemorativasDoDia', () => {
  it('dia sem data comemorativa devolve vazio', () => {
    expect(datasComemorativasDoDia(new Date(2026, 0, 15))).toEqual([])
  })

  it('encontra o Natal em 25/12, em qualquer ano', () => {
    expect(datasComemorativasDoDia(new Date(2026, 11, 25)).map((d) => d.nome)).toContain('Natal')
    expect(datasComemorativasDoDia(new Date(2030, 11, 25)).map((d) => d.nome)).toContain('Natal')
  })

  it('encontra a Independência em 07/09', () => {
    expect(datasComemorativasDoDia(new Date(2026, 8, 7)).map((d) => d.nome)).toContain('Independência do Brasil')
  })

  it('não confunde mês com dia (ex: 07/09 não é 09/07)', () => {
    expect(datasComemorativasDoDia(new Date(2026, 6, 9))).toEqual([])
  })
})
