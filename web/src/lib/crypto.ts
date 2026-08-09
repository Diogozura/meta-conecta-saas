/**
 * Criptografia simétrica (AES-256-GCM) para campos sensíveis salvos no
 * Firestore (businessToken e appSecret da Meta, em lib/firestore.ts).
 *
 * Compatível com dados legados: registros criados antes desta mudança têm
 * esses campos em texto puro. `decrypt()` detecta isso (não bate o formato
 * esperado) e devolve o valor original sem alterar — só criptografa a
 * partir da próxima gravação (ver `encrypt()` chamado em criarMetaAccess/
 * atualizarMetaAccess).
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16
// Marca o valor como cifrado por nós — texto puro legado nunca começa assim.
const PREFIX = 'enc_v1:'

function getKey(): Buffer {
  const secret = process.env.CREDENTIALS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY não configurada em web/.env.local. Gere uma com: ' +
        `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
    )
  }
  const key = Buffer.from(secret, 'base64')
  if (key.length !== 32) {
    throw new Error('CREDENTIALS_ENCRYPTION_KEY deve decodificar para exatamente 32 bytes (base64).')
  }
  return key
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/** Descriptografa; se o valor não tiver o prefixo esperado, assume texto puro legado e devolve como está. */
export function decrypt(value: string): string {
  if (!value || !value.startsWith(PREFIX)) {
    return value
  }
  const data = Buffer.from(value.slice(PREFIX.length), 'base64')
  const iv = data.subarray(0, IV_LENGTH)
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
  const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function isEncrypted(value: string | undefined | null): boolean {
  return !!value && value.startsWith(PREFIX)
}
