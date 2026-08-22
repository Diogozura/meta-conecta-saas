import { describe, expect, it } from 'vitest'
import { extensaoPorMime, tipoMidiaPorMime } from './mediaTipo'

describe('extensaoPorMime', () => {
  it('reconhece os MIME types mais comuns do WhatsApp', () => {
    expect(extensaoPorMime('image/jpeg')).toBe('jpg')
    expect(extensaoPorMime('audio/ogg')).toBe('ogg')
    expect(extensaoPorMime('application/pdf')).toBe('pdf')
  })

  it('ignora parâmetros extras no MIME type (ex: "audio/ogg; codecs=opus")', () => {
    expect(extensaoPorMime('audio/ogg; codecs=opus')).toBe('ogg')
  })

  it('cai pro subtype quando o MIME não é conhecido', () => {
    expect(extensaoPorMime('application/x-foo')).toBe('x-foo')
  })

  it('cai pra "bin" quando nem o subtype dá pra extrair', () => {
    expect(extensaoPorMime('lixo-sem-barra')).toBe('bin')
  })
})

describe('tipoMidiaPorMime', () => {
  it('classifica imagem, áudio e vídeo pelo prefixo do MIME', () => {
    expect(tipoMidiaPorMime('image/png')).toBe('image')
    expect(tipoMidiaPorMime('audio/mpeg')).toBe('audio')
    expect(tipoMidiaPorMime('video/mp4')).toBe('video')
  })

  it('trata qualquer outro MIME como documento', () => {
    expect(tipoMidiaPorMime('application/pdf')).toBe('document')
    expect(tipoMidiaPorMime('application/zip')).toBe('document')
  })
})
