/**
 * Conversões entre o valor bruto de um <input type="datetime-local"> (string "YYYY-MM-DDTHH:mm",
 * sem fuso nenhum embutido) e um instante real (Date/ISO em UTC).
 *
 * Sem fuso configurado na conta (`InstagramPublishConfig.fusoHorario` ausente): usa o fuso do
 * NAVEGADOR de quem está digitando — comportamento de sempre, sem mudança pra quem nunca mexeu
 * nisso (ver o bug de atraso de 3h já corrigido antes nesta mesma tela).
 *
 * Com fuso configurado: interpreta/mostra a hora como "hora de parede" NESSE fuso, não no fuso de
 * quem está com o navegador aberto — útil pra agência/equipe agendando de outro lugar do país.
 */

/** "Agora" no formato do input, no fuso do NAVEGADOR — `toISOString()` sozinho devolve UTC. */
export function nowLocalForInput(): string {
  const agora = new Date()
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** Mesma conversão de `nowLocalForInput`, a partir de uma data qualquer, no fuso do NAVEGADOR. */
export function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/**
 * Offset (em minutos) de `timeZone` em relação a UTC, no instante `date` — positivo pra fusos
 * ADIANTADOS em relação a UTC, negativo pra fusos ATRASADOS (São Paulo = -180). Calculado por
 * amostragem (nunca fixo), então já acerta horário de verão em fusos que o têm.
 */
function offsetMinutos(date: Date, timeZone: string): number {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date)
  const mapa: Record<string, string> = {}
  for (const p of partes) mapa[p.type] = p.value
  const comoUTC = Date.UTC(
    Number(mapa.year), Number(mapa.month) - 1, Number(mapa.day),
    Number(mapa.hour), Number(mapa.minute), Number(mapa.second),
  )
  return (comoUTC - date.getTime()) / 60000
}

/** "Agora" no formato do input, na hora de parede de `timeZone`. */
export function dataParaInputNoFuso(date: Date, timeZone: string): string {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(date)
  const mapa: Record<string, string> = {}
  for (const p of partes) mapa[p.type] = p.value
  return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}`
}

/** Interpreta "YYYY-MM-DDTHH:mm" como hora de parede EM `timeZone` e devolve o instante real (UTC). */
export function inputParaDataNoFuso(inputValue: string, timeZone: string): Date {
  const [dataParte, horaParte] = inputValue.split('T')
  const [ano, mes, dia] = dataParte.split('-').map(Number)
  const [hora, minuto] = (horaParte ?? '00:00').split(':').map(Number)
  const palpiteUTC = Date.UTC(ano, mes - 1, dia, hora, minuto)
  // Amostra o offset no palpite — erra só em minutos raros de transição de horário de verão,
  // aceitável pra "quando você quer publicar" (não é um sistema de cobrança/contrato).
  const offset = offsetMinutos(new Date(palpiteUTC), timeZone)
  return new Date(palpiteUTC - offset * 60000)
}

/** "Agora" no formato do input, no fuso configurado da conta (ou do navegador, se nenhum). */
export function nowParaInput(timeZone?: string): string {
  return timeZone ? dataParaInputNoFuso(new Date(), timeZone) : nowLocalForInput()
}

/** Formata uma data (ISO ou Date) pro input, no fuso configurado da conta (ou do navegador). */
export function dataParaInput(data: string | Date, timeZone?: string): string {
  const d = typeof data === 'string' ? new Date(data) : data
  return timeZone ? dataParaInputNoFuso(d, timeZone) : isoToLocalInput(d.toISOString())
}

/** Interpreta o valor bruto do input no fuso configurado da conta (ou do navegador). */
export function inputParaData(inputValue: string, timeZone?: string): Date {
  return timeZone ? inputParaDataNoFuso(inputValue, timeZone) : new Date(inputValue)
}
