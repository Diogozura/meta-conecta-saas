/**
 * Aviso (não bloqueio) de conflito de horário: outra publicação já agendada muito perto do
 * horário escolhido. Usado ao agendar/reagendar/arrastar no calendário — ver PublishTab.tsx e
 * CalendarTab.tsx.
 */

export interface PublicacaoParaConflito {
  id: string
  agendadoPara: string | Date
}

const JANELA_PADRAO_MINUTOS = 15

/**
 * Devolve a primeira publicação (excluindo `ignorarId`, útil ao reagendar ela mesma) cujo horário
 * fica a `janelaMinutos` ou menos do `candidato` — ou `undefined` se nenhuma estiver perto.
 */
export function encontrarConflito(
  candidato: Date,
  existentes: PublicacaoParaConflito[],
  opts?: { ignorarId?: string; janelaMinutos?: number },
): PublicacaoParaConflito | undefined {
  const janelaMs = (opts?.janelaMinutos ?? JANELA_PADRAO_MINUTOS) * 60000
  return existentes.find((p) => {
    if (opts?.ignorarId && p.id === opts.ignorarId) return false
    const diff = Math.abs(new Date(p.agendadoPara).getTime() - candidato.getTime())
    return diff <= janelaMs
  })
}
