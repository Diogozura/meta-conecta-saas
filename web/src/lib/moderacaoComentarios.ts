/**
 * Moderação automática de comentários novos (ver InstagramPublishConfig.moderacaoAutomaticaAtiva
 * e api/webhook/route.ts) — heurística por lista de termos, sem IA (webhook precisa responder
 * rápido e não pode depender de uma chamada externa lenta/paga só pra decidir ocultar ou não).
 */

// Lista curta e deliberadamente conservadora — xingamento explícito e spam óbvio, não gírias
// ambíguas que dependeriam de contexto (isso geraria falso positivo demais pra rodar sozinho,
// sem revisão humana).
export const TERMOS_MODERACAO_PADRAO = [
  'porra', 'caralho', 'foda-se', 'fdp', 'desgraça', 'arrombado', 'corno',
  'golpe', 'clique aqui', 'ganhe dinheiro fácil', 'compre seguidores', 'promoção imperdível clique',
]

/** Recebe o texto do comentário e devolve o(s) termo(s) da lista (padrão + extras da conta) que bateram. */
export function encontrarTermoModeracao(texto: string, termosExtras: string[] | undefined): string[] {
  const textoLower = texto.toLowerCase()
  const lista = [...TERMOS_MODERACAO_PADRAO, ...(termosExtras ?? [])]
  const encontrados = lista.filter((t) => t.trim() && textoLower.includes(t.trim().toLowerCase()))
  return Array.from(new Set(encontrados))
}
