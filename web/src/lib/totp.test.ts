import { describe, expect, it } from 'vitest'
import { TOTP, Secret } from 'otpauth'
import { gerarSegredoTotp, totpUri, validarCodigoTotp } from './totp'

describe('gerarSegredoTotp', () => {
  it('gera segredos diferentes a cada chamada', () => {
    expect(gerarSegredoTotp()).not.toBe(gerarSegredoTotp())
  })
})

describe('totpUri', () => {
  it('gera uma URI otpauth:// com o emissor no nome', () => {
    const uri = totpUri('JBSWY3DPEHPK3PXP', 'ana@empresa.com')
    expect(uri).toMatch(/^otpauth:\/\/totp\//)
    expect(uri).toContain('Zybot')
  })
})

describe('validarCodigoTotp', () => {
  const segredo = 'JBSWY3DPEHPK3PXP'
  const agora = new Date('2026-08-20T12:00:00Z')

  function gerarCodigoParaInstante(timestamp: number): string {
    const totp = new TOTP({ algorithm: 'SHA1', digits: 6, period: 30, secret: Secret.fromBase32(segredo) })
    return totp.generate({ timestamp })
  }

  it('aceita o código correto pro instante atual', () => {
    expect(validarCodigoTotp(segredo, gerarCodigoParaInstante(agora.getTime()), agora)).toBe(true)
  })

  it('rejeita um código errado', () => {
    expect(validarCodigoTotp(segredo, '000000', agora)).toBe(false)
  })

  it('rejeita texto que não é um código de 6 dígitos', () => {
    expect(validarCodigoTotp(segredo, 'abcdef', agora)).toBe(false)
    expect(validarCodigoTotp(segredo, '12345', agora)).toBe(false)
  })

  it('aceita o código do passo anterior (tolerância de relógio entre celular e servidor)', () => {
    const codigo = gerarCodigoParaInstante(agora.getTime() - 30_000)
    expect(validarCodigoTotp(segredo, codigo, agora)).toBe(true)
  })

  it('rejeita um código de muitos passos atrás (fora da janela de tolerância)', () => {
    const codigo = gerarCodigoParaInstante(agora.getTime() - 5 * 30_000)
    expect(validarCodigoTotp(segredo, codigo, agora)).toBe(false)
  })
})
