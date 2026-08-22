import { describe, expect, it } from 'vitest'
import { AVATAR_COLORS, avatarColor, getInitials } from './avatar'

describe('getInitials', () => {
  it('junta a primeira letra do primeiro e do último nome', () => {
    expect(getInitials('Maria Silva')).toBe('MS')
    expect(getInitials('Ana Paula Souza')).toBe('AS')
  })

  it('usa só uma letra quando há um único nome', () => {
    expect(getInitials('Diogo')).toBe('D')
  })

  it('ignora espaços extras', () => {
    expect(getInitials('  Maria   Silva  ')).toBe('MS')
  })
})

describe('avatarColor', () => {
  it('é determinístico pro mesmo id', () => {
    expect(avatarColor('abc123')).toBe(avatarColor('abc123'))
  })

  it('sempre retorna uma cor da paleta', () => {
    expect(AVATAR_COLORS).toContain(avatarColor('qualquer-id'))
    expect(AVATAR_COLORS).toContain(avatarColor(''))
  })
})
