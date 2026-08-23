import { describe, expect, it } from 'vitest'
import { substituirVariaveis, gerarProtocolo, avaliarCondicao } from './variaveisFluxo'

describe('substituirVariaveis', () => {
  it('troca {{chave}} pelo valor coletado', () => {
    expect(substituirVariaveis('Olá {{nome}}, seu CPF é {{cpf}}', { nome: 'Ana', cpf: '123' })).toBe('Olá Ana, seu CPF é 123')
  })

  it('mantém o token como está quando a chave não foi coletada', () => {
    expect(substituirVariaveis('Olá {{nome}}', { outraCoisa: 'x' })).toBe('Olá {{nome}}')
  })

  it('sem dados coletados nenhum, devolve o texto original', () => {
    expect(substituirVariaveis('Olá {{nome}}', undefined)).toBe('Olá {{nome}}')
  })

  it('aceita espaços dentro das chaves ({{ nome }})', () => {
    expect(substituirVariaveis('Olá {{ nome }}', { nome: 'Ana' })).toBe('Olá Ana')
  })

  it('texto sem nenhum token fica igual', () => {
    expect(substituirVariaveis('Olá, tudo bem?', { nome: 'Ana' })).toBe('Olá, tudo bem?')
  })
})

describe('gerarProtocolo', () => {
  it('gera no formato AAMMDD-XXXX', () => {
    const protocolo = gerarProtocolo(new Date('2026-08-23T12:00:00Z'))
    expect(protocolo).toMatch(/^260823-[A-Z0-9]{4}$/)
  })

  it('gera protocolos diferentes em chamadas seguidas', () => {
    const a = gerarProtocolo(new Date('2026-08-23T12:00:00Z'))
    const b = gerarProtocolo(new Date('2026-08-23T12:00:00Z'))
    expect(a).not.toBe(b)
  })
})

describe('avaliarCondicao', () => {
  it('vazio/preenchido', () => {
    expect(avaliarCondicao(undefined, 'vazio', undefined)).toBe(true)
    expect(avaliarCondicao('  ', 'vazio', undefined)).toBe(true)
    expect(avaliarCondicao('algo', 'vazio', undefined)).toBe(false)
    expect(avaliarCondicao('algo', 'preenchido', undefined)).toBe(true)
    expect(avaliarCondicao(undefined, 'preenchido', undefined)).toBe(false)
  })

  it('igual/diferente ignoram maiúsculas/minúsculas e espaços nas pontas', () => {
    expect(avaliarCondicao('Sim', 'igual', ' sim ')).toBe(true)
    expect(avaliarCondicao('Sim', 'diferente', 'não')).toBe(true)
    expect(avaliarCondicao('Sim', 'igual', 'não')).toBe(false)
  })

  it('contem — substring, ignorando maiúsculas/minúsculas', () => {
    expect(avaliarCondicao('Quero cancelar o plano', 'contem', 'cancelar')).toBe(true)
    expect(avaliarCondicao('Quero cancelar o plano', 'contem', 'reembolso')).toBe(false)
  })

  it('maior/menor comparam numericamente, aceitando vírgula decimal', () => {
    expect(avaliarCondicao('18', 'maior', '17')).toBe(true)
    expect(avaliarCondicao('17', 'maior', '18')).toBe(false)
    expect(avaliarCondicao('9,5', 'menor', '10')).toBe(true)
  })

  it('maior/menor com valor não-numérico dá falso, sem lançar', () => {
    expect(avaliarCondicao('não sei', 'maior', '10')).toBe(false)
    expect(avaliarCondicao('10', 'menor', 'abc')).toBe(false)
  })
})
