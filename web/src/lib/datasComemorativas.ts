/**
 * Datas comemorativas/comerciais relevantes pro Brasil — marcadas automaticamente no calendário
 * (ver CalendarTab.tsx) como lembrete de pauta, não é feriado oficial nem afeta agendamento
 * nenhum. Lista fixa e deliberadamente enxuta (datas de peso comercial real), não every-single-dia
 * bobo do "dia mundial de".
 */

export interface DataComemorativa {
  mes: number // 1-12
  dia: number
  nome: string
}

export const DATAS_COMEMORATIVAS: DataComemorativa[] = [
  { mes: 1, dia: 1, nome: 'Ano Novo' },
  { mes: 2, dia: 14, nome: 'Dia dos Namorados (EUA/internacional)' },
  { mes: 3, dia: 8, nome: 'Dia Internacional da Mulher' },
  { mes: 4, dia: 21, nome: 'Tiradentes' },
  { mes: 5, dia: 1, nome: 'Dia do Trabalho' },
  { mes: 5, dia: 12, nome: 'Dia das Mães (2º domingo de maio — data aproximada)' },
  { mes: 6, dia: 12, nome: 'Dia dos Namorados' },
  { mes: 8, dia: 11, nome: 'Dia dos Pais (2º domingo de agosto — data aproximada)' },
  { mes: 9, dia: 7, nome: 'Independência do Brasil' },
  { mes: 10, dia: 12, nome: "Dia das Crianças / N. Sra. Aparecida" },
  { mes: 10, dia: 15, nome: 'Dia do Professor' },
  { mes: 11, dia: 2, nome: 'Finados' },
  { mes: 11, dia: 15, nome: 'Proclamação da República' },
  { mes: 11, dia: 20, nome: 'Consciência Negra' },
  { mes: 11, dia: 27, nome: 'Black Friday (última sexta de novembro — data aproximada)' },
  { mes: 12, dia: 25, nome: 'Natal' },
  { mes: 12, dia: 31, nome: 'Véspera de Ano Novo' },
]

/** Datas comemorativas que caem num dia específico (mês/dia, ignorando o ano). */
export function datasComemorativasDoDia(data: Date): DataComemorativa[] {
  return DATAS_COMEMORATIVAS.filter((d) => d.mes === data.getMonth() + 1 && d.dia === data.getDate())
}
