/**
 * Checagens de texto pra legenda do Instagram — dois alertas distintos:
 * 1. Termos proibidos: lista configurável POR CONTA (concorrente, gíria fora do tom de marca,
 *    termo do nicho que a empresa não quer usar) — ver InstagramPublishConfig.termosProibidos.
 * 2. Risco de política: padrões conhecidos de "engagement bait" e alegações exageradas que o
 *    Instagram costuma penalizar — lista FIXA, igual à de hashtagsArriscadas.ts (heurística, sem
 *    fonte oficial da Meta, só um alerta de atenção).
 */

/** Recebe a legenda e a lista de termos proibidos da conta — devolve os que aparecem nela. */
export function encontrarTermosProibidos(caption: string, termosProibidos: string[] | undefined): string[] {
  if (!termosProibidos || termosProibidos.length === 0) return []
  const textoLower = caption.toLowerCase()
  return termosProibidos.filter((t) => t.trim() && textoLower.includes(t.trim().toLowerCase()))
}

const RISCOS_POLITICA_INSTAGRAM: { termo: RegExp; motivo: string }[] = [
  { termo: /\bmarque\s+\d+\s+amigos?\b/i, motivo: 'pedir pra marcar vários amigos ("engagement bait")' },
  { termo: /\bsiga\s+e\s+ganhe\b/i, motivo: 'condicionar prêmio a seguir a conta' },
  { termo: /\bcura\s+garantid[ao]\b/i, motivo: 'alegação de saúde não comprovada' },
  { termo: /\bemagre[çc]a?\s+\d+\s*(kg|quilos)\s+em\b/i, motivo: 'promessa de emagrecimento em prazo fixo' },
  { termo: /\brenda\s+extra\s+garantida\b/i, motivo: 'alegação financeira não comprovada' },
  { termo: /\bfique\s+rico\s+r[áa]pido\b/i, motivo: 'esquema de enriquecimento rápido' },
  { termo: /\bsorteio\b.*\bpix\b/i, motivo: 'sorteio pedindo Pix (comum em golpes reportados)' },
  { termo: /\blink\s+na\s+bio\s+pra\s+ganhar\b/i, motivo: 'isca de engajamento pro link da bio' },
]

/** Recebe a legenda e devolve os padrões de risco de política encontrados (motivo de cada um). */
export function encontrarRiscosPolitica(caption: string): string[] {
  return RISCOS_POLITICA_INSTAGRAM.filter((r) => r.termo.test(caption)).map((r) => r.motivo)
}
