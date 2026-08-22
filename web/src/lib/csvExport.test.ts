import { describe, expect, it } from 'vitest'
import { eventosParaCsv } from './csvExport'
import type { EventoAtendimento } from '@/types/database'

describe('eventosParaCsv', () => {
  it('gera o cabeçalho mesmo sem eventos', () => {
    expect(eventosParaCsv([])).toBe('Data,Número,Evento,Setor,Atendente')
  })

  it('formata uma linha por evento com o rótulo em português', () => {
    const eventos: EventoAtendimento[] = [
      { id: '1', numero: '5511999990000', tipo: 'transferida_humano', setor: 'Financeiro', criadoEm: new Date('2026-08-20T10:00:00Z') },
    ]
    const csv = eventosParaCsv(eventos)
    const linhas = csv.split('\r\n')
    expect(linhas).toHaveLength(2)
    expect(linhas[1]).toBe('2026-08-20T10:00:00.000Z,5511999990000,Transferida para humano,Financeiro,')
  })

  it('escapa valores com vírgula, aspas ou quebra de linha', () => {
    const eventos: EventoAtendimento[] = [
      { id: '1', numero: '1', tipo: 'assumida', setor: 'Suporte, Nível 2', atendenteNome: 'Ana "Rocket" Silva', criadoEm: new Date('2026-08-20T10:00:00Z') },
    ]
    const linha = eventosParaCsv(eventos).split('\r\n')[1]
    expect(linha).toContain('"Suporte, Nível 2"')
    expect(linha).toContain('"Ana ""Rocket"" Silva"')
  })

  it('deixa setor/atendente vazios quando ausentes, sem quebrar', () => {
    const eventos: EventoAtendimento[] = [{ id: '1', numero: '1', tipo: 'encerrada', criadoEm: new Date('2026-08-20T10:00:00Z') }]
    expect(eventosParaCsv(eventos).split('\r\n')[1]).toBe('2026-08-20T10:00:00.000Z,1,Encerrada,,')
  })
})
