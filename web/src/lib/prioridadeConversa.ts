import { buscarClientePorNumero, definirPrioridadeConversa } from '@/lib/firestore'

const TAGS_PRIORITARIAS = ['vip', 'prioritário', 'prioritario', 'urgente']

/** Se a tag do Cliente indica prioridade (VIP, prioritário, urgente) — comparação sem acento/maiúsculas. */
export function ehTagPrioritaria(tag: string | null | undefined): boolean {
  if (!tag) return false
  const normalizada = tag
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos (combining diacritical marks)
    .trim()
    .toLowerCase()
  return TAGS_PRIORITARIAS.some((t) => normalizada.includes(t))
}

/**
 * Se o Cliente cadastrado pra esse número tem uma tag de prioridade (ex:
 * "VIP"), marca a conversa como prioridade alta automaticamente — chamado
 * ao abrir/reabrir uma conversa no webhook. Silencioso: cliente não
 * encontrado ou sem tag relevante simplesmente não muda nada (prioridade
 * fica 'normal', o padrão).
 */
export async function aplicarPrioridadeAutomatica(contaId: string, numero: string): Promise<void> {
  const cliente = await buscarClientePorNumero(contaId, numero)
  if (!ehTagPrioritaria(cliente?.tag)) return
  await definirPrioridadeConversa(contaId, numero, 'alta')
}
