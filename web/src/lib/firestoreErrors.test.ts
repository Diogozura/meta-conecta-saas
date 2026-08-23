import { describe, expect, it } from 'vitest'
import { isFirestoreQuotaExceededError, isDailyQuotaExceededError, FirestoreQuotaExceededError } from './firestoreErrors'

describe('isFirestoreQuotaExceededError', () => {
  it('reconhece pelo código gRPC 8 (RESOURCE_EXHAUSTED)', () => {
    expect(isFirestoreQuotaExceededError({ code: 8, message: 'algo qualquer' })).toBe(true)
  })

  it('reconhece pela mensagem quando o código não vem preenchido', () => {
    expect(isFirestoreQuotaExceededError({ message: '8 RESOURCE_EXHAUSTED: Quota exceeded.' })).toBe(true)
    expect(isFirestoreQuotaExceededError({ message: 'Quota exceeded for reads.' })).toBe(true)
  })

  it('não reconhece outros erros', () => {
    expect(isFirestoreQuotaExceededError({ code: 5, message: 'NOT_FOUND' })).toBe(false)
    expect(isFirestoreQuotaExceededError(new Error('conexão recusada'))).toBe(false)
    expect(isFirestoreQuotaExceededError(null)).toBe(false)
    expect(isFirestoreQuotaExceededError('string qualquer')).toBe(false)
  })
})

describe('isDailyQuotaExceededError', () => {
  it('reconhece quando a mensagem menciona explicitamente o limite diário', () => {
    expect(isDailyQuotaExceededError({ message: "Quota exceeded for quota metric 'Read requests' and limit 'ReadRequestsPerDay'" })).toBe(true)
    expect(isDailyQuotaExceededError({ message: 'daily quota exceeded' })).toBe(true)
    expect(isDailyQuotaExceededError({ message: 'passou da cota diária' })).toBe(true)
  })

  it('NÃO reconhece um "RESOURCE_EXHAUSTED" genérico (pico de tráfego, não cota diária)', () => {
    expect(isDailyQuotaExceededError({ message: '8 RESOURCE_EXHAUSTED: Quota exceeded.' })).toBe(false)
    expect(isDailyQuotaExceededError({ code: 8, message: 'Quota exceeded.' })).toBe(false)
  })
})

describe('FirestoreQuotaExceededError', () => {
  it('mensagem de cota diária menciona "diário" e não confunde com pico de tráfego', () => {
    const erro = new FirestoreQuotaExceededError(true)
    expect(erro.message).toMatch(/diário/i)
  })

  it('mensagem padrão (pico de tráfego) deixa claro que NÃO é a cota diária', () => {
    const erro = new FirestoreQuotaExceededError(false)
    expect(erro.message).toMatch(/não é a cota diária/i)
  })

  it('sem argumento, assume o caso mais comum (pico de tráfego, não cota diária)', () => {
    const erro = new FirestoreQuotaExceededError()
    expect(erro.message).toMatch(/não é a cota diária/i)
  })
})
