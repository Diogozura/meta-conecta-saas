/**
 * Gera um arquivo .ics (iCalendar) com os agendamentos do Instagram — formato aberto que o
 * Google Calendar, Outlook e Apple Calendar importam nativamente. Mais simples e confiável do
 * que integrar a API do Google Calendar de verdade (que já existe no app, mas é por PROFISSIONAL
 * da Agenda — um conceito diferente de "calendário de conteúdo da conta").
 */

import type { PublicacaoInstagram } from '@/types/database'

function formatarDataUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
}

function escaparTexto(texto: string): string {
  return texto.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

const TIPO_LABEL: Record<PublicacaoInstagram['tipo'], string> = {
  IMAGE: 'Post',
  VIDEO: 'Vídeo',
  REELS: 'Reels',
  STORIES: 'Story',
  CAROUSEL: 'Carrossel',
}

export function gerarIcsPublicacoesInstagram(publicacoes: PublicacaoInstagram[]): string {
  const agora = formatarDataUTC(new Date())
  const eventos = publicacoes
    .filter((p) => p.agendadoPara)
    .map((p) => {
      const inicio = new Date(p.agendadoPara!)
      const fim = new Date(inicio.getTime() + 30 * 60000) // evento de 30 min, só pra aparecer no calendário — a publicação em si é instantânea
      const titulo = `[Instagram] ${TIPO_LABEL[p.tipo]}${p.tema ? ` — ${p.tema}` : ''}`
      const descricao = p.caption ? escaparTexto(p.caption) : ''
      return [
        'BEGIN:VEVENT',
        `UID:zybot-instagram-${p.id}@zybot`,
        `DTSTAMP:${agora}`,
        `DTSTART:${formatarDataUTC(inicio)}`,
        `DTEND:${formatarDataUTC(fim)}`,
        `SUMMARY:${escaparTexto(titulo)}`,
        ...(descricao ? [`DESCRIPTION:${descricao}`] : []),
        'END:VEVENT',
      ].join('\r\n')
    })

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zybot//Calendario Instagram//PT',
    'CALSCALE:GREGORIAN',
    ...eventos,
    'END:VCALENDAR',
  ].join('\r\n')
}
