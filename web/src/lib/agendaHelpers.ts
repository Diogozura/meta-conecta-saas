import { Profissional } from '@/types/database'

/** Remove o refresh token descriptografado antes de devolver o Profissional pro cliente. */
export function sanitizeProfissional(profissional: Profissional): Omit<Profissional, 'google'> & { google?: Omit<NonNullable<Profissional['google']>, 'refreshTokenEnc'> } {
  if (!profissional.google) return profissional
  return {
    ...profissional,
    google: {
      conectado: profissional.google.conectado,
      calendarId: profissional.google.calendarId,
      email: profissional.google.email,
    },
  }
}

export interface Intervalo {
  inicio: Date
  fim: Date
}

/** Junta intervalos sobrepostos/adjacentes numa lista mínima e ordenada. */
function mesclarIntervalos(intervalos: Intervalo[]): Intervalo[] {
  if (intervalos.length === 0) return []
  const ordenados = [...intervalos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
  const mesclados: Intervalo[] = [ordenados[0]]

  for (const atual of ordenados.slice(1)) {
    const ultimo = mesclados[mesclados.length - 1]
    if (atual.inicio.getTime() <= ultimo.fim.getTime()) {
      if (atual.fim.getTime() > ultimo.fim.getTime()) ultimo.fim = atual.fim
    } else {
      mesclados.push({ ...atual })
    }
  }

  return mesclados
}

/** Subtrai `ocupados` de um único intervalo `disponivel`, retornando os pedaços livres restantes. */
function subtrairOcupados(disponivel: Intervalo, ocupados: Intervalo[]): Intervalo[] {
  let livres: Intervalo[] = [{ ...disponivel }]

  for (const ocupado of ocupados) {
    const proximos: Intervalo[] = []
    for (const livre of livres) {
      const inicioOverlap = Math.max(livre.inicio.getTime(), ocupado.inicio.getTime())
      const fimOverlap = Math.min(livre.fim.getTime(), ocupado.fim.getTime())

      if (inicioOverlap >= fimOverlap) {
        // Sem sobreposição — mantém o pedaço livre como está.
        proximos.push(livre)
        continue
      }
      // Sobra antes e/ou depois da sobreposição.
      if (livre.inicio.getTime() < inicioOverlap) {
        proximos.push({ inicio: livre.inicio, fim: new Date(inicioOverlap) })
      }
      if (fimOverlap < livre.fim.getTime()) {
        proximos.push({ inicio: new Date(fimOverlap), fim: livre.fim })
      }
    }
    livres = proximos
  }

  return livres
}

/**
 * Calcula os horários livres para agendamento: blocos de `disponibilidades`
 * menos os intervalos `ocupados` (agendamentos existentes + freebusy do
 * Google), fatiados em slots de `duracaoMinutos` (a duração do serviço).
 */
export function calcularHorariosLivres(params: {
  disponibilidades: Intervalo[]
  ocupados: Intervalo[]
  duracaoMinutos: number
  agora?: Date
}): Intervalo[] {
  const agora = params.agora ?? new Date()
  const ocupadosMesclados = mesclarIntervalos(params.ocupados)
  const duracaoMs = params.duracaoMinutos * 60 * 1000

  const slots: Intervalo[] = []

  for (const bloco of params.disponibilidades) {
    const livres = subtrairOcupados(bloco, ocupadosMesclados)
    for (const livre of livres) {
      let inicioSlot = Math.max(livre.inicio.getTime(), agora.getTime())
      while (inicioSlot + duracaoMs <= livre.fim.getTime()) {
        slots.push({ inicio: new Date(inicioSlot), fim: new Date(inicioSlot + duracaoMs) })
        inicioSlot += duracaoMs
      }
    }
  }

  return slots.sort((a, b) => a.inicio.getTime() - b.inicio.getTime())
}
