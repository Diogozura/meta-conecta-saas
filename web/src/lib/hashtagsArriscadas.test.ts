import { describe, expect, it } from 'vitest'
import { encontrarHashtagsArriscadas } from './hashtagsArriscadas'

describe('encontrarHashtagsArriscadas', () => {
  it('legenda sem hashtags não acusa nada', () => {
    expect(encontrarHashtagsArriscadas('Só uma legenda normal, sem nada')).toEqual([])
  })

  it('hashtags comuns (não arriscadas) não acusam nada', () => {
    expect(encontrarHashtagsArriscadas('Confira #promocao #lojaX #verao2026')).toEqual([])
  })

  it('detecta uma hashtag arriscada conhecida', () => {
    expect(encontrarHashtagsArriscadas('Bora crescer juntos #like4like')).toEqual(['like4like'])
  })

  it('ignora o "#" e é case-insensitive', () => {
    expect(encontrarHashtagsArriscadas('#LIKE4LIKE hoje')).toEqual(['like4like'])
  })

  it('detecta hashtags arriscadas em português', () => {
    expect(encontrarHashtagsArriscadas('#curtaeganheseguidor vamos lá')).toEqual(['curtaeganheseguidor'])
  })

  it('devolve várias hashtags arriscadas sem duplicar repetidas', () => {
    const achadas = encontrarHashtagsArriscadas('#like4like #like4like #f4f #promocao')
    expect(achadas.sort()).toEqual(['f4f', 'like4like'])
  })

  it('não confunde uma menção (@) com hashtag', () => {
    expect(encontrarHashtagsArriscadas('@like4like não é hashtag')).toEqual([])
  })
})
