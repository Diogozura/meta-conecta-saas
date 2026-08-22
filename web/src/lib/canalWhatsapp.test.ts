import { describe, expect, it } from 'vitest'
import { resolverPhoneNumberId } from './canalWhatsapp'

const METATODO = { phoneNumberId: 'principal', numerosAdicionais: [{ phoneNumberId: 'loja-2' }, { phoneNumberId: 'loja-3' }] }

describe('resolverPhoneNumberId', () => {
  it('usa o número principal quando a conversa não tem canal salvo', () => {
    expect(resolverPhoneNumberId(METATODO, undefined)).toBe('principal')
    expect(resolverPhoneNumberId(METATODO, null)).toBe('principal')
  })

  it('usa o canal da conversa quando é um número adicional válido', () => {
    expect(resolverPhoneNumberId(METATODO, 'loja-2')).toBe('loja-2')
  })

  it('usa o canal quando é o próprio número principal', () => {
    expect(resolverPhoneNumberId(METATODO, 'principal')).toBe('principal')
  })

  it('cai pro principal quando o canal salvo não pertence mais à conta (ex: número removido)', () => {
    expect(resolverPhoneNumberId(METATODO, 'numero-removido')).toBe('principal')
  })

  it('cai pro principal quando a conta não tem números adicionais', () => {
    expect(resolverPhoneNumberId({ phoneNumberId: 'principal' }, 'qualquer')).toBe('principal')
  })
})
