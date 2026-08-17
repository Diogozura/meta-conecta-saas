/**
 * Detecta o Firestore recusando uma leitura/escrita por ter estourado a cota
 * (código gRPC 8 = RESOURCE_EXHAUSTED, que é o que aparece quando o limite
 * diário do tier gratuito — ou o limite de requisições/segundo — é
 * ultrapassado). Sem isso, esse erro cai nos mesmos catches genéricos que
 * tratam "usuário não autenticado", e as duas coisas viram a mesma
 * mensagem confusa pra quem está usando o painel.
 */
export function isFirestoreQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: unknown; message?: unknown }
  if (err.code === 8) return true
  const mensagem = typeof err.message === 'string' ? err.message : String(error)
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(mensagem)
}

export class FirestoreQuotaExceededError extends Error {
  constructor() {
    super('Passou do limite diário de requisição do Firebase. Tente novamente em alguns minutos.')
    this.name = 'FirestoreQuotaExceededError'
  }
}
