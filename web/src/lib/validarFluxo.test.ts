import { describe, expect, it } from 'vitest'
import { validarFluxo } from './validarFluxo'
import type { FluxoNodeTipo } from '@/types/database'

const TODOS_OS_TIPOS: FluxoNodeTipo[] = [
  'inicio', 'mensagem', 'menu', 'horario', 'coleta', 'encaminhar_ia', 'encaminhar_humano', 'fim',
  'enviar_template', 'enviar_url', 'enviar_email', 'nota_interna', 'solicitar_localizacao', 'gerar_qrcode', 'adicionar_etiqueta', 'gerar_protocolo',
  'definir_variavel', 'condicao_variavel', 'pausar',
  'ir_para_fluxo',
]

function corpoValido(tipo: FluxoNodeTipo) {
  return {
    nome: 'Fluxo de teste',
    ativo: true,
    nodes: [{ id: 'inicio', tipo: 'inicio' }, { id: 'n2', tipo }],
    edges: [{ id: 'e1', origem: 'inicio', destino: 'n2' }],
  }
}

describe('validarFluxo', () => {
  it.each(TODOS_OS_TIPOS)('aceita um fluxo contendo um nó do tipo "%s"', (tipo) => {
    expect(validarFluxo(corpoValido(tipo))).not.toBeNull()
  })

  it('rejeita um tipo de nó desconhecido', () => {
    expect(validarFluxo(corpoValido('tipo_que_nao_existe' as FluxoNodeTipo))).toBeNull()
  })

  it('rejeita sem nome', () => {
    expect(validarFluxo({ nome: '', ativo: true, nodes: [{ id: 'inicio', tipo: 'inicio' }], edges: [] })).toBeNull()
  })

  it('rejeita sem nó "inicio"', () => {
    expect(validarFluxo({ nome: 'Fluxo', ativo: true, nodes: [{ id: 'n1', tipo: 'mensagem' }], edges: [] })).toBeNull()
  })

  it('rejeita corpo que não é objeto', () => {
    expect(validarFluxo(null)).toBeNull()
    expect(validarFluxo('string')).toBeNull()
  })

  it('aceita e recorta espaços do nome', () => {
    const resultado = validarFluxo({ nome: '  Fluxo com espaços  ', ativo: false, nodes: [{ id: 'inicio', tipo: 'inicio' }], edges: [] })
    expect(resultado?.nome).toBe('Fluxo com espaços')
  })
})
