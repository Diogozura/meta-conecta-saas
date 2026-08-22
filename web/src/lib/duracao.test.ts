import { describe, expect, it } from 'vitest'
import { formatDuracao, minutosParaUnidade, unidadeParaMinutos } from './duracao'

describe('unidadeParaMinutos', () => {
  it('converte minutos, horas e dias pra minutos', () => {
    expect(unidadeParaMinutos('30', 'minutos')).toBe(30)
    expect(unidadeParaMinutos('2', 'horas')).toBe(120)
    expect(unidadeParaMinutos('1', 'dias')).toBe(1440)
  })

  it('aceita vírgula decimal', () => {
    expect(unidadeParaMinutos('1,5', 'horas')).toBe(90)
  })

  it('arredonda resultados fracionários', () => {
    expect(unidadeParaMinutos('0.5', 'minutos')).toBe(1)
  })

  it('retorna 0 pra entradas inválidas, zero ou negativas', () => {
    expect(unidadeParaMinutos('', 'minutos')).toBe(0)
    expect(unidadeParaMinutos('abc', 'minutos')).toBe(0)
    expect(unidadeParaMinutos('0', 'horas')).toBe(0)
    expect(unidadeParaMinutos('-5', 'minutos')).toBe(0)
  })
})

describe('minutosParaUnidade', () => {
  it('prefere dias quando divide exato', () => {
    expect(minutosParaUnidade(2880)).toEqual({ valor: '2', unidade: 'dias' })
  })

  it('prefere horas quando divide exato mas não é múltiplo de um dia', () => {
    expect(minutosParaUnidade(120)).toEqual({ valor: '2', unidade: 'horas' })
  })

  it('cai pra minutos quando não é múltiplo redondo de nada', () => {
    expect(minutosParaUnidade(45)).toEqual({ valor: '45', unidade: 'minutos' })
  })

  it('mantém minutos para zero', () => {
    expect(minutosParaUnidade(0)).toEqual({ valor: '0', unidade: 'minutos' })
  })
})

describe('formatDuracao', () => {
  it('formata no singular e no plural corretamente', () => {
    expect(formatDuracao(60)).toBe('1 hora')
    expect(formatDuracao(120)).toBe('2 horas')
    expect(formatDuracao(1440)).toBe('1 dia')
    expect(formatDuracao(2880)).toBe('2 dias')
    expect(formatDuracao(45)).toBe('45 min')
  })

  it('faz o roundtrip com unidadeParaMinutos', () => {
    const minutos = unidadeParaMinutos('3', 'horas')
    expect(formatDuracao(minutos)).toBe('3 horas')
  })
})
