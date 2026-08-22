import type { EventoAtendimento } from '@/types/database'

const TIPO_EVENTO_LABEL: Record<EventoAtendimento['tipo'], string> = {
  aberta: 'Conversa aberta',
  transferida_humano: 'Transferida para humano',
  assumida: 'Assumida por atendente',
  liberada: 'Liberada de volta pra fila',
  encerrada: 'Encerrada',
}

/** Escapa um valor pra uma célula CSV (RFC 4180) — aspas duplas quando o valor tem vírgula, aspas ou quebra de linha. */
function escapeCsv(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`
  return valor
}

/** Monta um CSV do histórico de atendimentos — uma linha por evento, pronto pra auditoria/planilha. */
export function eventosParaCsv(eventos: EventoAtendimento[]): string {
  const cabecalho = ['Data', 'Número', 'Evento', 'Setor', 'Atendente']
  const linhas = eventos.map((e) =>
    [
      new Date(e.criadoEm).toISOString(),
      e.numero,
      TIPO_EVENTO_LABEL[e.tipo],
      e.setor ?? '',
      e.atendenteNome ?? '',
    ]
      .map((v) => escapeCsv(String(v)))
      .join(',')
  )
  // \r\n é o separador de linha padrão do CSV (RFC 4180) — Excel em particular é sensível a isso.
  return [cabecalho.join(','), ...linhas].join('\r\n')
}
