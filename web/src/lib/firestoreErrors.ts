/**
 * Detecta o Firestore recusando uma leitura/escrita por ter estourado a cota
 * (código gRPC 8 = RESOURCE_EXHAUSTED, que é o que aparece quando o limite
 * diário do tier gratuito — ou o limite de requisições/segundo — é
 * ultrapassado). Sem isso, esse erro cai nos mesmos catches genéricos que
 * tratam "usuário não autenticado", e as duas coisas viram a mesma
 * mensagem confusa pra quem está usando o painel.
 */
function mensagemBrutaDoErro(error: unknown): string {
  if (!error || typeof error !== 'object') return String(error)
  const err = error as { message?: unknown }
  return typeof err.message === 'string' ? err.message : String(error)
}

export function isFirestoreQuotaExceededError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: unknown }
  if (err.code === 8) return true
  return /RESOURCE_EXHAUSTED|Quota exceeded/i.test(mensagemBrutaDoErro(error))
}

/**
 * O código 8 (RESOURCE_EXHAUSTED) cobre dois cenários bem diferentes: a
 * cota diária gratuita realmente esgotada (confirmável no console do
 * Firebase — Firestore > Uso) ou o Firestore freando um PICO repentino de
 * requisições mesmo bem abaixo do limite diário (o caso mais comum na
 * prática — vários restarts/testes seguidos em pouco tempo — e que passa
 * sozinho em minutos, não precisa esperar a cota resetar). Quando a
 * mensagem do próprio erro menciona explicitamente "day"/"diári", é o
 * primeiro caso; senão, assume o segundo.
 */
export function isDailyQuotaExceededError(error: unknown): boolean {
  return /per[ -]?day|daily|diári/i.test(mensagemBrutaDoErro(error))
}

export class FirestoreQuotaExceededError extends Error {
  constructor(cotaDiaria: boolean = false) {
    super(
      cotaDiaria
        ? 'Passou do limite diário de requisição do Firebase. A cota reseta à meia-noite (horário do Pacífico dos EUA) — tente novamente daqui a algumas horas, ou confira o uso em Firebase Console > Firestore > Uso.'
        : 'O Firestore recusou um pico repentino de requisições — não é a cota diária (o projeto está bem abaixo dela). Costuma passar sozinho em poucos minutos.'
    )
    this.name = 'FirestoreQuotaExceededError'
  }
}
