import { describe, expect, it } from 'vitest'
import { encontrarTermoModeracao } from './moderacaoComentarios'

describe('encontrarTermoModeracao', () => {
  it('comentário normal não acusa nada', () => {
    expect(encontrarTermoModeracao('Adorei o post, ficou lindo!', undefined)).toEqual([])
  })

  it('detecta um termo padrão da lista', () => {
    expect(encontrarTermoModeracao('que produto de merda, é golpe', undefined)).toEqual(['golpe'])
  })

  it('é case-insensitive', () => {
    expect(encontrarTermoModeracao('CLIQUE AQUI pra ganhar', undefined)).toEqual(['clique aqui'])
  })

  it('detecta termo extra configurado pela conta', () => {
    expect(encontrarTermoModeracao('esse concorrentex é melhor', ['concorrentex'])).toEqual(['concorrentex'])
  })

  it('sem termos extras, ainda funciona só com a lista padrão', () => {
    expect(encontrarTermoModeracao('isso é golpe', [])).toEqual(['golpe'])
  })

  it('devolve todos os termos encontrados sem duplicar', () => {
    const achados = encontrarTermoModeracao('golpe, golpe, compre seguidores', undefined)
    expect(achados.sort()).toEqual(['compre seguidores', 'golpe'])
  })
})
