import { describe, expect, it } from 'vitest'
import { continuarFluxo, estaDentroDoHorario, iniciarFluxo } from './fluxoEngine'
import type { Fluxo, FluxoEdge, FluxoHorario, FluxoNode } from '@/types/database'

function no(partial: Partial<FluxoNode> & Pick<FluxoNode, 'id' | 'tipo'>): FluxoNode {
  return { posicao: { x: 0, y: 0 }, ...partial }
}

function aresta(partial: Partial<FluxoEdge> & Pick<FluxoEdge, 'id' | 'origem' | 'destino'>): FluxoEdge {
  return { ...partial }
}

/** Fluxo típico de ISP/telemarketing: boas-vindas -> menu (1 suporte, 2 financeiro, 3 falar com atendente) -> cada opção leva a um destino diferente. */
function fluxoMenuSetores(): Pick<Fluxo, 'nodes' | 'edges'> {
  const nodes: FluxoNode[] = [
    no({ id: 'inicio', tipo: 'inicio' }),
    no({ id: 'boas-vindas', tipo: 'mensagem', texto: 'Olá! Bem-vindo à Acme Internet.' }),
    no({
      id: 'menu-principal',
      tipo: 'menu',
      texto: 'Digite 1 para Suporte técnico, 2 para Financeiro ou 3 para falar com um atendente.',
      opcoes: [
        { id: 'op-suporte', rotulo: '1' },
        { id: 'op-financeiro', rotulo: '2' },
        { id: 'op-atendente', rotulo: '3' },
      ],
    }),
    no({ id: 'ia-suporte', tipo: 'encaminhar_ia' }),
    no({ id: 'humano-financeiro', tipo: 'encaminhar_humano', setor: 'Financeiro', motivo: 'Cliente escolheu Financeiro no menu' }),
    no({ id: 'humano-generico', tipo: 'encaminhar_humano' }),
  ]
  const edges: FluxoEdge[] = [
    aresta({ id: 'e1', origem: 'inicio', destino: 'boas-vindas' }),
    aresta({ id: 'e2', origem: 'boas-vindas', destino: 'menu-principal' }),
    aresta({ id: 'e3', origem: 'menu-principal', destino: 'ia-suporte', opcaoId: 'op-suporte' }),
    aresta({ id: 'e4', origem: 'menu-principal', destino: 'humano-financeiro', opcaoId: 'op-financeiro' }),
    aresta({ id: 'e5', origem: 'menu-principal', destino: 'humano-generico', opcaoId: 'op-atendente' }),
  ]
  return { nodes, edges }
}

describe('iniciarFluxo', () => {
  it('percorre os nós de mensagem automáticos e para no primeiro menu, acumulando os textos', () => {
    const resultado = iniciarFluxo(fluxoMenuSetores())
    expect(resultado).toEqual({
      acao: 'enviar_e_aguardar',
      mensagens: ['Olá! Bem-vindo à Acme Internet.', 'Digite 1 para Suporte técnico, 2 para Financeiro ou 3 para falar com um atendente.'],
      noId: 'menu-principal',
    })
  })

  it('encaminha pra IA quando não há nó inicio', () => {
    const resultado = iniciarFluxo({ nodes: [], edges: [] })
    expect(resultado).toEqual({ acao: 'encaminhar_ia', mensagens: [] })
  })

  it('encerra a conversa quando uma mensagem não tem aresta de saída', () => {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), no({ id: 'fim-msg', tipo: 'mensagem', texto: 'Até mais!' })]
    const edges: FluxoEdge[] = [aresta({ id: 'e1', origem: 'inicio', destino: 'fim-msg' })]
    expect(iniciarFluxo({ nodes, edges })).toEqual({ acao: 'encerrar', mensagens: ['Até mais!'] })
  })

  it('detecta ciclo e cai pra IA em vez de travar', () => {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), no({ id: 'a', tipo: 'mensagem', texto: 'oi' }), no({ id: 'b', tipo: 'mensagem', texto: 'de novo' })]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'a' }),
      aresta({ id: 'e2', origem: 'a', destino: 'b' }),
      aresta({ id: 'e3', origem: 'b', destino: 'a' }),
    ]
    const resultado = iniciarFluxo({ nodes, edges })
    expect(resultado.acao).toBe('encaminhar_ia')
  })
})

describe('continuarFluxo', () => {
  it('roteia pra IA quando o cliente digita a opção 1', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '1')
    expect(resultado).toEqual({ acao: 'encaminhar_ia', mensagens: [] })
  })

  it('roteia pro setor Financeiro quando o cliente digita a opção 2', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '2')
    expect(resultado).toEqual({ acao: 'encaminhar_humano', mensagens: [], setor: 'Financeiro', motivo: 'Cliente escolheu Financeiro no menu' })
  })

  it('roteia pra fila humana genérica (sem setor) quando o cliente digita a opção 3', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '3')
    expect(resultado).toEqual({ acao: 'encaminhar_humano', mensagens: [], setor: undefined, motivo: undefined })
  })

  it('ignora espaços e maiúsculas/minúsculas ao comparar a opção digitada', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '  1  ')
    expect(resultado.acao).toBe('encaminhar_ia')
  })

  it('repete o menu quando a opção digitada não existe', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '9')
    expect(resultado).toEqual({
      acao: 'opcao_invalida',
      mensagens: ['Digite 1 para Suporte técnico, 2 para Financeiro ou 3 para falar com um atendente.'],
      noId: 'menu-principal',
    })
  })

  it('reinicia o fluxo se o nó salvo não existe mais (fluxo foi editado)', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'no-que-nao-existe-mais', '1')
    expect(resultado.acao).toBe('enviar_e_aguardar')
  })

  it('reinicia o fluxo se o nó salvo não é mais um menu (mudou de tipo na edição)', () => {
    const grafo = fluxoMenuSetores()
    const resultado = continuarFluxo(grafo, 'boas-vindas', '1')
    expect(resultado.acao).toBe('enviar_e_aguardar')
  })
})

// Datas com offset fixo -03:00 (Brasília não observa horário de verão desde
// 2019) — o dia da semana é derivado do próprio Date construído, então o
// teste não depende de saber de cabeça em que dia da semana cai uma data específica.
const SP_MEIO_DIA = new Date('2026-08-19T12:00:00-03:00')
const SP_NOITE = new Date('2026-08-19T20:00:00-03:00')
const DIA_DA_SEMANA = SP_MEIO_DIA.getUTCDay()

function horarioComercial(overrides: Partial<FluxoHorario> = {}): FluxoHorario {
  const diasSemana = [false, false, false, false, false, false, false]
  diasSemana[DIA_DA_SEMANA] = true
  return { diasSemana, horaInicio: '09:00', horaFim: '18:00', ...overrides }
}

describe('estaDentroDoHorario', () => {
  it('está dentro no meio do expediente, no dia configurado', () => {
    expect(estaDentroDoHorario(horarioComercial(), SP_MEIO_DIA)).toBe(true)
  })

  it('está fora depois do horário de fechamento', () => {
    expect(estaDentroDoHorario(horarioComercial(), SP_NOITE)).toBe(false)
  })

  it('está fora quando o dia da semana não está marcado (ex: fim de semana fechado)', () => {
    const diasSemana = [false, false, false, false, false, false, false] // nenhum dia marcado
    expect(estaDentroDoHorario({ diasSemana, horaInicio: '09:00', horaFim: '18:00' }, SP_MEIO_DIA)).toBe(false)
  })

  it('inclui o horário de início e exclui o horário de fim (janela [início, fim))', () => {
    const inicioExato = new Date('2026-08-19T09:00:00-03:00')
    const fimExato = new Date('2026-08-19T18:00:00-03:00')
    expect(estaDentroDoHorario(horarioComercial(), inicioExato)).toBe(true)
    expect(estaDentroDoHorario(horarioComercial(), fimExato)).toBe(false)
  })

  it('trata configuração inválida (fim antes/igual ao início) como sempre fechado', () => {
    expect(estaDentroDoHorario(horarioComercial({ horaFim: '09:00' }), SP_MEIO_DIA)).toBe(false)
    expect(estaDentroDoHorario(horarioComercial({ horaFim: '08:00' }), SP_MEIO_DIA)).toBe(false)
  })
})

/** Fluxo com um nó de horário: dentro do expediente vai pra IA, fora vai pra fila humana do plantão. */
function fluxoComHorario(): Pick<Fluxo, 'nodes' | 'edges'> {
  const nodes: FluxoNode[] = [
    no({ id: 'inicio', tipo: 'inicio' }),
    no({ id: 'checa-horario', tipo: 'horario', horario: horarioComercial() }),
    no({ id: 'ia', tipo: 'encaminhar_ia' }),
    no({ id: 'plantao', tipo: 'encaminhar_humano', setor: 'Plantão', motivo: 'Fora do horário comercial' }),
  ]
  const edges: FluxoEdge[] = [
    aresta({ id: 'e1', origem: 'inicio', destino: 'checa-horario' }),
    aresta({ id: 'e2', origem: 'checa-horario', destino: 'ia', opcaoId: 'dentro' }),
    aresta({ id: 'e3', origem: 'checa-horario', destino: 'plantao', opcaoId: 'fora' }),
  ]
  return { nodes, edges }
}

describe('fluxo com nó de horário', () => {
  it('segue pra IA quando está dentro do horário configurado', () => {
    expect(iniciarFluxo(fluxoComHorario(), SP_MEIO_DIA)).toEqual({ acao: 'encaminhar_ia', mensagens: [] })
  })

  it('segue pro setor de plantão quando está fora do horário configurado', () => {
    expect(iniciarFluxo(fluxoComHorario(), SP_NOITE)).toEqual({
      acao: 'encaminhar_humano',
      mensagens: [],
      setor: 'Plantão',
      motivo: 'Fora do horário comercial',
    })
  })

  it('cai pra IA se o nó de horário não tem aresta pro resultado calculado', () => {
    const grafo = fluxoComHorario()
    grafo.edges = grafo.edges.filter((e) => e.opcaoId !== 'fora')
    expect(iniciarFluxo(grafo, SP_NOITE)).toEqual({ acao: 'encaminhar_ia', mensagens: [] })
  })
})

/** Fluxo com um nó de coleta (pede o CPF) antes de encaminhar pra IA. */
function fluxoComColeta(): Pick<Fluxo, 'nodes' | 'edges'> {
  const nodes: FluxoNode[] = [
    no({ id: 'inicio', tipo: 'inicio' }),
    no({ id: 'pede-cpf', tipo: 'coleta', texto: 'Qual seu CPF?', variavel: 'cpf' }),
    no({ id: 'ia', tipo: 'encaminhar_ia' }),
  ]
  const edges: FluxoEdge[] = [
    aresta({ id: 'e1', origem: 'inicio', destino: 'pede-cpf' }),
    aresta({ id: 'e2', origem: 'pede-cpf', destino: 'ia' }),
  ]
  return { nodes, edges }
}

describe('fluxo com nó de coleta', () => {
  it('para no nó de coleta e envia a pergunta, esperando qualquer resposta', () => {
    expect(iniciarFluxo(fluxoComColeta())).toEqual({ acao: 'enviar_e_aguardar', mensagens: ['Qual seu CPF?'], noId: 'pede-cpf' })
  })

  it('aceita qualquer texto como resposta (não é um menu de opções fixas) e segue em frente', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'pede-cpf', '123.456.789-00')
    expect(resultado).toEqual({ acao: 'encaminhar_ia', mensagens: [] })
  })

  it('aceita até resposta vazia/qualquer coisa — coleta não valida formato, só captura', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'pede-cpf', 'não quero informar')
    expect(resultado.acao).toBe('encaminhar_ia')
  })

  it('encerra se o nó de coleta não tem aresta de saída', () => {
    const grafo = fluxoComColeta()
    grafo.edges = grafo.edges.filter((e) => e.origem !== 'pede-cpf')
    expect(continuarFluxo(grafo, 'pede-cpf', 'qualquer coisa')).toEqual({ acao: 'encerrar', mensagens: [] })
  })

  it('reinicia o fluxo se o nó salvo não existe mais', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'no-removido', 'resposta')
    expect(resultado.acao).toBe('enviar_e_aguardar')
  })
})
