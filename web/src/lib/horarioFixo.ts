import { dataParaInput, inputParaData } from './fusoHorario'

const DIAS_CURTOS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function diaSemanaEm(date: Date, timeZone?: string): number {
  if (!timeZone) return date.getDay()
  const nome = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date)
  return DIAS_CURTOS.indexOf(nome)
}

/**
 * Calcula a próxima ocorrência de um horário fixo semanal ("toda terça às 18h") a partir de
 * `agora`, na hora de parede de `timeZone` (fuso configurado da conta) — ou do navegador de quem
 * está agendando, se nenhum fuso estiver configurado. Nunca devolve algo no passado.
 */
export function proximaOcorrencia(diaSemana: number, horario: string, agora: Date = new Date(), timeZone?: string): Date {
  for (let offsetDias = 0; offsetDias < 8; offsetDias++) {
    const candidato = new Date(agora.getTime() + offsetDias * 86400000)
    if (diaSemanaEm(candidato, timeZone) !== diaSemana) continue
    const dataParte = dataParaInput(candidato, timeZone).slice(0, 10)
    const resultado = inputParaData(`${dataParte}T${horario}`, timeZone)
    if (resultado.getTime() > agora.getTime()) return resultado
  }
  // Inatingível: diaSemana é sempre 0-6, e o loop cobre 8 dias (garante bater 2x nesse intervalo).
  return agora
}
