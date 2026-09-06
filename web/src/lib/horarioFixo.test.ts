import { describe, expect, it } from 'vitest'
import { proximaOcorrencia } from './horarioFixo'

// Datas construídas com o construtor local (ano, mês, dia, hora, min) — `getDay()`/`setHours()`
// também são locais, então os dois lados sempre concordam entre si, não importa o fuso da
// máquina que roda o teste (CI, Windows local etc).
function dataLocal(ano: number, mes: number, dia: number, hora = 0, min = 0) {
  return new Date(ano, mes, dia, hora, min, 0, 0)
}

describe('proximaOcorrencia', () => {
  it('quando o dia-alvo é hoje e o horário ainda não chegou, devolve hoje nesse horário', () => {
    const agora = dataLocal(2026, 5, 15, 10, 0) // qualquer dia, 10:00
    const resultado = proximaOcorrencia(agora.getDay(), '18:00', agora)
    expect(resultado.getFullYear()).toBe(2026)
    expect(resultado.getMonth()).toBe(5)
    expect(resultado.getDate()).toBe(15)
    expect(resultado.getHours()).toBe(18)
    expect(resultado.getMinutes()).toBe(0)
  })

  it('quando o dia-alvo é hoje mas o horário já passou, pula pra semana que vem (mesmo dia da semana)', () => {
    const agora = dataLocal(2026, 5, 15, 20, 0) // 20:00, depois das 18:00
    const resultado = proximaOcorrencia(agora.getDay(), '18:00', agora)
    const diffDias = Math.round((resultado.getTime() - dataLocal(2026, 5, 15, 18, 0).getTime()) / 86400000)
    expect(diffDias).toBe(7)
    expect(resultado.getDay()).toBe(agora.getDay())
  })

  it('quando o dia-alvo ainda não chegou nessa semana, devolve dentro dessa mesma semana', () => {
    const agora = dataLocal(2026, 5, 15, 10, 0)
    const diaAlvo = (agora.getDay() + 2) % 7
    const resultado = proximaOcorrencia(diaAlvo, '09:00', agora)
    expect(resultado.getDay()).toBe(diaAlvo)
    const diffDias = Math.round((resultado.getTime() - dataLocal(2026, 5, 15, 9, 0).getTime()) / 86400000)
    expect(diffDias).toBe(2)
  })

  it('nunca devolve algo no passado', () => {
    const agora = dataLocal(2026, 5, 15, 10, 0)
    for (let dia = 0; dia < 7; dia++) {
      const resultado = proximaOcorrencia(dia, '00:00', agora)
      expect(resultado.getTime()).toBeGreaterThan(agora.getTime())
    }
  })
})

describe('proximaOcorrencia com fuso configurado', () => {
  it('interpreta o horário na hora de parede do fuso configurado, não do navegador', () => {
    // 2026-06-16 é uma terça-feira (UTC) — diaSemana 2, meio-dia UTC, bem longe de qualquer troca de dia.
    const agora = new Date('2026-06-16T12:00:00.000Z')
    const resultado = proximaOcorrencia(2, '18:00', agora, 'America/Sao_Paulo')
    // 18:00 em São Paulo (UTC-3) no mesmo dia é 21:00 UTC — ainda no futuro em relação a 12:00 UTC.
    expect(resultado.toISOString()).toBe('2026-06-16T21:00:00.000Z')
  })

  it('pula pra semana que vem quando o horário nesse fuso já passou', () => {
    const agora = new Date('2026-06-16T22:00:00.000Z') // já passou das 21:00 UTC (18h em SP)
    const resultado = proximaOcorrencia(2, '18:00', agora, 'America/Sao_Paulo')
    expect(resultado.toISOString()).toBe('2026-06-23T21:00:00.000Z')
  })
})
