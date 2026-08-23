import { describe, expect, it } from 'vitest'
import { validarNovoTicket, validarAtualizacaoTicket } from './validarTicket'

describe('validarNovoTicket', () => {
  it('aceita um ticket mínimo (numero + assunto), com prioridade padrão "normal"', () => {
    expect(validarNovoTicket({ numero: '5511999999999', assunto: 'Internet lenta' })).toEqual({
      numero: '5511999999999',
      assunto: 'Internet lenta',
      prioridade: 'normal',
    })
  })

  it('aceita descrição e prioridade explícitas, e recorta espaços', () => {
    expect(validarNovoTicket({ numero: ' 5511999999999 ', assunto: ' Internet lenta ', descricao: ' Cai toda tarde ', prioridade: 'alta' })).toEqual({
      numero: '5511999999999',
      assunto: 'Internet lenta',
      descricao: 'Cai toda tarde',
      prioridade: 'alta',
    })
  })

  it('rejeita sem numero ou sem assunto', () => {
    expect(validarNovoTicket({ assunto: 'X' })).toBeNull()
    expect(validarNovoTicket({ numero: '123' })).toBeNull()
    expect(validarNovoTicket({ numero: '  ', assunto: 'X' })).toBeNull()
  })

  it('rejeita prioridade inválida', () => {
    expect(validarNovoTicket({ numero: '123', assunto: 'X', prioridade: 'crítica' })).toBeNull()
  })

  it('rejeita corpo que não é objeto', () => {
    expect(validarNovoTicket(null)).toBeNull()
    expect(validarNovoTicket('string')).toBeNull()
  })
})

describe('validarAtualizacaoTicket', () => {
  it('aceita mudar só o status', () => {
    expect(validarAtualizacaoTicket({ status: 'resolvido' })).toEqual({ status: 'resolvido' })
  })

  it('aceita mudar só a prioridade', () => {
    expect(validarAtualizacaoTicket({ prioridade: 'urgente' })).toEqual({ prioridade: 'urgente' })
  })

  it('aceita atribuir um atendente (e limpa o nome se não vier)', () => {
    expect(validarAtualizacaoTicket({ atendenteId: 'u1', atendenteNome: 'Maria' })).toEqual({ atendenteId: 'u1', atendenteNome: 'Maria' })
    expect(validarAtualizacaoTicket({ atendenteId: 'u1' })).toEqual({ atendenteId: 'u1', atendenteNome: null })
  })

  it('aceita liberar o atendente (null)', () => {
    expect(validarAtualizacaoTicket({ atendenteId: null })).toEqual({ atendenteId: null, atendenteNome: null })
  })

  it('rejeita status inválido', () => {
    expect(validarAtualizacaoTicket({ status: 'urgente' })).toBeNull()
  })

  it('rejeita corpo vazio (nada pra atualizar)', () => {
    expect(validarAtualizacaoTicket({})).toBeNull()
  })

  it('rejeita corpo que não é objeto', () => {
    expect(validarAtualizacaoTicket(null)).toBeNull()
  })
})
