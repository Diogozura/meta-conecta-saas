import { TOTP, Secret } from 'otpauth'

const EMISSOR = 'Zybot'

/** Gera um novo segredo TOTP (base32, 160 bits) — usado uma vez ao iniciar o cadastro do 2FA. */
export function gerarSegredoTotp(): string {
  return new Secret({ size: 20 }).base32
}

function criarTotp(segredoBase32: string, label?: string): TOTP {
  return new TOTP({
    issuer: EMISSOR,
    label,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: Secret.fromBase32(segredoBase32),
  })
}

/** URI "otpauth://" pro QR code — o app autenticador (Google Authenticator, Authy, etc.) lê isso direto. */
export function totpUri(segredoBase32: string, label: string): string {
  return criarTotp(segredoBase32, label).toString()
}

/** Valida um código de 6 dígitos digitado pelo usuário, aceitando 1 passo (±30s) de tolerância pra dessincronia comum de relógio entre celular e servidor. */
export function validarCodigoTotp(segredoBase32: string, codigo: string, agora: Date = new Date()): boolean {
  const limpo = codigo.replace(/\s/g, '')
  if (!/^\d{6}$/.test(limpo)) return false
  const delta = criarTotp(segredoBase32).validate({ token: limpo, window: 1, timestamp: agora.getTime() })
  return delta !== null
}
