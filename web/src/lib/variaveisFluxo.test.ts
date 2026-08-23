import { describe, expect, it } from 'vitest'
import { substituirVariaveis, gerarProtocolo } from './variaveisFluxo'

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
