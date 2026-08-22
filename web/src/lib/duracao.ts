export type DuracaoUnidade = 'minutos' | 'horas' | 'dias'

export const MINUTOS_POR_UNIDADE: Record<DuracaoUnidade, number> = { minutos: 1, horas: 60, dias: 60 * 24 }

/** Converte um valor digitado numa unidade (ex: "2" + "horas") para minutos inteiros. Retorna 0 se inválido. */
export function unidadeParaMinutos(valor: string, unidade: DuracaoUnidade): number {
  const n = parseFloat(valor.replace(',', '.'))
  if (!n || n <= 0) return 0
  return Math.round(n * MINUTOS_POR_UNIDADE[unidade])
}

/** Escolhe a maior unidade "redonda" pra representar uma duração em minutos, sem casas decimais. */
export function minutosParaUnidade(minutos: number): { valor: string; unidade: DuracaoUnidade } {
  if (minutos > 0 && minutos % MINUTOS_POR_UNIDADE.dias === 0) {
    return { valor: String(minutos / MINUTOS_POR_UNIDADE.dias), unidade: 'dias' }
  }
  if (minutos > 0 && minutos % MINUTOS_POR_UNIDADE.horas === 0) {
    return { valor: String(minutos / MINUTOS_POR_UNIDADE.horas), unidade: 'horas' }
  }
  return { valor: String(minutos), unidade: 'minutos' }
}

/** Formata uma duração em minutos pra exibição, ex: 120 → "2 horas", 90 → "90 min". */
export function formatDuracao(minutos: number): string {
  const { valor, unidade } = minutosParaUnidade(minutos)
  const n = Number(valor)
  const label = unidade === 'dias' ? (n === 1 ? 'dia' : 'dias') : unidade === 'horas' ? (n === 1 ? 'hora' : 'horas') : 'min'
  return `${valor} ${label}`
}
