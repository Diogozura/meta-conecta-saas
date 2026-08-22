/** Extrai uma nota 0-10 de um texto livre ("9", "nota 8", "10/10") — null se não achar um número válido nesse intervalo. */
export function extrairNotaCsat(texto: string): number | null {
  const match = texto.trim().match(/-?\d+/)
  if (!match) return null
  const nota = parseInt(match[0], 10)
  if (!Number.isFinite(nota) || nota < 0 || nota > 10) return null
  return nota
}
