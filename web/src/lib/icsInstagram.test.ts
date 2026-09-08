import { describe, expect, it } from 'vitest'
import { gerarIcsPublicacoesInstagram } from './icsInstagram'
import type { PublicacaoInstagram } from '@/types/database'

function publicacaoBase(overrides: Partial<PublicacaoInstagram>): PublicacaoInstagram {
  return {
    id: 'p1',
    contaId: 'c1',
    tipo: 'IMAGE',
    status: 'agendado',
    dataCriacao: new Date('2026-06-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('gerarIcsPublicacoesInstagram', () => {
  it('sem publicações, gera um calendário vazio mas válido', () => {
    const ics = gerarIcsPublicacoesInstagram([])
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('ignora publicações sem agendadoPara (rascunhos)', () => {
    const ics = gerarIcsPublicacoesInstagram([publicacaoBase({ status: 'rascunho' })])
    expect(ics).not.toContain('BEGIN:VEVENT')
  })

  it('gera um evento com data/hora corretas pra uma publicação agendada', () => {
    const ics = gerarIcsPublicacoesInstagram([
      publicacaoBase({ agendadoPara: new Date('2026-06-15T18:00:00.000Z'), caption: 'Legenda de teste' }),
    ])
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('DTSTART:20260615T180000Z')
    expect(ics).toContain('SUMMARY:[Instagram] Post')
    expect(ics).toContain('DESCRIPTION:Legenda de teste')
    expect(ics).toContain('UID:zybot-instagram-p1@zybot')
  })

  it('inclui o tema no título quando presente', () => {
    const ics = gerarIcsPublicacoesInstagram([
      publicacaoBase({ agendadoPara: new Date('2026-06-15T18:00:00.000Z'), tipo: 'REELS', tema: 'Lançamento X' }),
    ])
    expect(ics).toContain('SUMMARY:[Instagram] Reels — Lançamento X')
  })

  it('escapa vírgula, ponto e vírgula e quebra de linha na legenda', () => {
    const ics = gerarIcsPublicacoesInstagram([
      publicacaoBase({ agendadoPara: new Date('2026-06-15T18:00:00.000Z'), caption: 'Linha 1\nCafé, chá; água' }),
    ])
    expect(ics).toContain('DESCRIPTION:Linha 1\\nCafé\\, chá\\; água')
  })

  it('gera um evento por publicação, na ordem recebida', () => {
    const ics = gerarIcsPublicacoesInstagram([
      publicacaoBase({ id: 'a', agendadoPara: new Date('2026-06-15T18:00:00.000Z') }),
      publicacaoBase({ id: 'b', agendadoPara: new Date('2026-06-16T18:00:00.000Z') }),
    ])
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    expect(ics.indexOf('zybot-instagram-a')).toBeLessThan(ics.indexOf('zybot-instagram-b'))
  })
})
