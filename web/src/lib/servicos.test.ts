import { describe, expect, it } from 'vitest'
import { temServico } from './servicos'

describe('temServico', () => {
  it('conta sem servicosContratados (legada/nunca configurada) tem acesso a tudo', () => {
    expect(temServico(undefined, 'whatsapp')).toBe(true)
    expect(temServico(null, 'agenda')).toBe(true)
  })

  it('respeita true/false explícitos definidos por um admin', () => {
    expect(temServico({ whatsapp: true, agenda: false, instagram: true }, 'agenda')).toBe(false)
    expect(temServico({ whatsapp: true, agenda: false, instagram: true }, 'whatsapp')).toBe(true)
  })

  it('um módulo omitido dentro de um objeto parcial ainda conta como liberado', () => {
    expect(temServico({ whatsapp: false }, 'instagram')).toBe(true)
  })
})
