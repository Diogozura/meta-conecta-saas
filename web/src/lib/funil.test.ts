import { describe, expect, it } from 'vitest'
import { ETAPAS_PADRAO, obterEtapasFunil, etapaAtualId, validarFunilEtapas } from './funil'

describe('obterEtapasFunil', () => {
  it('sem lista configurada, usa as etapas padrão', () => {
    expect(obterEtapasFunil(undefined)).toEqual(ETAPAS_PADRAO)
    expect(obterEtapasFunil(null)).toEqual(ETAPAS_PADRAO)
    expect(obterEtapasFunil([])).toEqual(ETAPAS_PADRAO)
  })

  it('com lista customizada, usa ela em vez do padrão', () => {
    const customizado = [{ id: 'a', nome: 'A', cor: '#000000' }]
    expect(obterEtapasFunil(customizado)).toEqual(customizado)
  })
})

describe('etapaAtualId', () => {
  const etapas = ETAPAS_PADRAO

  it('conversa sem etapa cai na primeira coluna', () => {
    expect(etapaAtualId(undefined, etapas)).toBe('novo')
    expect(etapaAtualId(null, etapas)).toBe('novo')
  })

  it('etapa existente é respeitada', () => {
    expect(etapaAtualId('fechado', etapas)).toBe('fechado')
  })

  it('etapa que não existe mais (excluída) cai de volta na primeira coluna', () => {
    expect(etapaAtualId('etapa-removida', etapas)).toBe('novo')
  })
})

describe('validarFunilEtapas', () => {
  it('aceita uma lista bem formada', () => {
    expect(validarFunilEtapas([{ id: 'a', nome: 'A', cor: '#ff0000' }])).toEqual([{ id: 'a', nome: 'A', cor: '#ff0000' }])
  })

  it('rejeita lista vazia', () => {
    expect(validarFunilEtapas([])).toBeNull()
  })

  it('rejeita algo que não é array', () => {
    expect(validarFunilEtapas(null)).toBeNull()
    expect(validarFunilEtapas({})).toBeNull()
  })

  it('rejeita ids duplicados', () => {
    expect(validarFunilEtapas([{ id: 'a', nome: 'A', cor: '#ff0000' }, { id: 'a', nome: 'B', cor: '#00ff00' }])).toBeNull()
  })

  it('rejeita nome vazio', () => {
    expect(validarFunilEtapas([{ id: 'a', nome: '  ', cor: '#ff0000' }])).toBeNull()
  })

  it('rejeita cor fora do formato hex', () => {
    expect(validarFunilEtapas([{ id: 'a', nome: 'A', cor: 'vermelho' }])).toBeNull()
  })

  it('rejeita mais de 20 etapas', () => {
    const muitas = Array.from({ length: 21 }, (_, i) => ({ id: `e${i}`, nome: `Etapa ${i}`, cor: '#ff0000' }))
    expect(validarFunilEtapas(muitas)).toBeNull()
  })
})
