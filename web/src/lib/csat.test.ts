import { describe, expect, it } from 'vitest'
import { extrairNotaCsat } from './csat'

describe('extrairNotaCsat', () => {
  it('extrai um número puro', () => {
    expect(extrairNotaCsat('9')).toBe(9)
    expect(extrairNotaCsat('0')).toBe(0)
    expect(extrairNotaCsat('10')).toBe(10)
  })

  it('extrai o número mesmo com texto ao redor', () => {
    expect(extrairNotaCsat('nota 8')).toBe(8)
    expect(extrairNotaCsat('Eu daria um 7!')).toBe(7)
    expect(extrairNotaCsat('10/10')).toBe(10)
  })

  it('rejeita números fora do intervalo 0-10', () => {
    expect(extrairNotaCsat('11')).toBeNull()
    expect(extrairNotaCsat('99')).toBeNull()
  })

  it('rejeita texto sem nenhum número', () => {
    expect(extrairNotaCsat('muito bom')).toBeNull()
    expect(extrairNotaCsat('')).toBeNull()
  })

  it('ignora espaços em volta', () => {
    expect(extrairNotaCsat('  6  ')).toBe(6)
  })
})
