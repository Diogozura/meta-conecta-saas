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
      acoes: [
        { tipo: 'texto', texto: 'Olá! Bem-vindo à Acme Internet.' },
        { tipo: 'texto', texto: 'Digite 1 para Suporte técnico, 2 para Financeiro ou 3 para falar com um atendente.' },
      ],
      noId: 'menu-principal',
    })
  })

  it('encaminha pra IA quando não há nó inicio', () => {
    const resultado = iniciarFluxo({ nodes: [], edges: [] })
    expect(resultado).toEqual({ acao: 'encaminhar_ia', acoes: [] })
  })

  it('encerra a conversa quando uma mensagem não tem aresta de saída', () => {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), no({ id: 'fim-msg', tipo: 'mensagem', texto: 'Até mais!' })]
    const edges: FluxoEdge[] = [aresta({ id: 'e1', origem: 'inicio', destino: 'fim-msg' })]
    expect(iniciarFluxo({ nodes, edges })).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'texto', texto: 'Até mais!' }] })
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
    expect(resultado).toEqual({ acao: 'encaminhar_ia', acoes: [] })
  })

  it('roteia pro setor Financeiro quando o cliente digita a opção 2', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '2')
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: 'Financeiro', motivo: 'Cliente escolheu Financeiro no menu' })
  })

  it('roteia pra fila humana genérica (sem setor) quando o cliente digita a opção 3', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '3')
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: undefined, motivo: undefined })
  })

  it('ignora espaços e maiúsculas/minúsculas ao comparar a opção digitada', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '  1  ')
    expect(resultado.acao).toBe('encaminhar_ia')
  })

  it('repete o menu quando a opção digitada não existe', () => {
    const resultado = continuarFluxo(fluxoMenuSetores(), 'menu-principal', '9')
    expect(resultado).toEqual({
      acao: 'opcao_invalida',
      acoes: [{ tipo: 'texto', texto: 'Digite 1 para Suporte técnico, 2 para Financeiro ou 3 para falar com um atendente.' }],
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
    expect(iniciarFluxo(fluxoComHorario(), SP_MEIO_DIA)).toEqual({ acao: 'encaminhar_ia', acoes: [] })
  })

  it('segue pro setor de plantão quando está fora do horário configurado', () => {
    expect(iniciarFluxo(fluxoComHorario(), SP_NOITE)).toEqual({
      acao: 'encaminhar_humano',
      acoes: [],
      setor: 'Plantão',
      motivo: 'Fora do horário comercial',
    })
  })

  it('cai pra IA se o nó de horário não tem aresta pro resultado calculado', () => {
    const grafo = fluxoComHorario()
    grafo.edges = grafo.edges.filter((e) => e.opcaoId !== 'fora')
    expect(iniciarFluxo(grafo, SP_NOITE)).toEqual({ acao: 'encaminhar_ia', acoes: [] })
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
    expect(iniciarFluxo(fluxoComColeta())).toEqual({ acao: 'enviar_e_aguardar', acoes: [{ tipo: 'texto', texto: 'Qual seu CPF?' }], noId: 'pede-cpf' })
  })

  it('aceita qualquer texto como resposta (não é um menu de opções fixas) e segue em frente', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'pede-cpf', '123.456.789-00')
    expect(resultado).toEqual({ acao: 'encaminhar_ia', acoes: [] })
  })

  it('aceita até resposta vazia/qualquer coisa — coleta não valida formato, só captura', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'pede-cpf', 'não quero informar')
    expect(resultado.acao).toBe('encaminhar_ia')
  })

  it('encerra se o nó de coleta não tem aresta de saída', () => {
    const grafo = fluxoComColeta()
    grafo.edges = grafo.edges.filter((e) => e.origem !== 'pede-cpf')
    expect(continuarFluxo(grafo, 'pede-cpf', 'qualquer coisa')).toEqual({ acao: 'encerrar', acoes: [] })
  })

  it('reinicia o fluxo se o nó salvo não existe mais', () => {
    const resultado = continuarFluxo(fluxoComColeta(), 'no-removido', 'resposta')
    expect(resultado.acao).toBe('enviar_e_aguardar')
  })
})

describe('pacote "mensageria essencial" — nós automáticos geram a ação certa e seguem em frente', () => {
  function fluxoComUmNoAutomatico(noAutomatico: FluxoNode): Pick<Fluxo, 'nodes' | 'edges'> {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), noAutomatico, no({ id: 'fim', tipo: 'fim' })]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: noAutomatico.id }),
      aresta({ id: 'e2', origem: noAutomatico.id, destino: 'fim' }),
    ]
    return { nodes, edges }
  }

  it('enviar_template gera uma ação "template" e segue', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'tpl', tipo: 'enviar_template', templateNome: 'boas_vindas' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'template', nome: 'boas_vindas' }] })
  })

  it('enviar_template sem nome escolhido não gera ação nenhuma (mas segue em frente)', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'tpl', tipo: 'enviar_template' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [] })
  })

  it('enviar_url gera uma ação "url" com texto, link e rótulo do botão', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'url', tipo: 'enviar_url', texto: 'Veja nosso catálogo:', url: 'https://exemplo.com', botaoLabel: 'Ver mais' }))
    expect(iniciarFluxo(grafo)).toEqual({
      acao: 'encerrar',
      acoes: [{ tipo: 'url', texto: 'Veja nosso catálogo:', url: 'https://exemplo.com', label: 'Ver mais' }],
    })
  })

  it('enviar_url sem rótulo definido cai pro rótulo padrão "Abrir link"', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'url', tipo: 'enviar_url', texto: 'Veja:', url: 'https://exemplo.com' }))
    const resultado = iniciarFluxo(grafo)
    expect(resultado.acoes).toEqual([{ tipo: 'url', texto: 'Veja:', url: 'https://exemplo.com', label: 'Abrir link' }])
  })

  it('enviar_email gera uma ação "email" com destinatário, assunto e corpo', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'mail', tipo: 'enviar_email', emailDestinatario: 'a@b.com', emailAssunto: 'Novo lead', texto: 'Chegou um lead novo' }))
    expect(iniciarFluxo(grafo)).toEqual({
      acao: 'encerrar',
      acoes: [{ tipo: 'email', destinatario: 'a@b.com', assunto: 'Novo lead', corpo: 'Chegou um lead novo' }],
    })
  })

  it('nota_interna gera uma ação "nota" com o estilo escolhido (padrão "info")', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'nota', tipo: 'nota_interna', texto: 'Cliente parece irritado', estiloNota: 'alerta' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'nota', texto: 'Cliente parece irritado', estilo: 'alerta' }] })
  })

  it('gerar_qrcode gera uma ação "qrcode" com o conteúdo a codificar', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'qr', tipo: 'gerar_qrcode', texto: 'https://exemplo.com/pix' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'qrcode', conteudo: 'https://exemplo.com/pix' }] })
  })

  it('adicionar_etiqueta gera uma ação "etiqueta"', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'tag', tipo: 'adicionar_etiqueta', etiqueta: 'Lead quente' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'etiqueta', valor: 'Lead quente' }] })
  })

  it('gerar_protocolo sempre gera uma ação "protocolo", com ou sem mensagem', () => {
    const comMensagem = fluxoComUmNoAutomatico(no({ id: 'proto', tipo: 'gerar_protocolo', texto: 'Seu protocolo: {{protocolo}}' }))
    expect(iniciarFluxo(comMensagem)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'protocolo', mensagem: 'Seu protocolo: {{protocolo}}' }] })

    const semMensagem = fluxoComUmNoAutomatico(no({ id: 'proto', tipo: 'gerar_protocolo' }))
    expect(iniciarFluxo(semMensagem)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'protocolo', mensagem: null }] })
  })
})

describe('fluxo com nó de solicitar_localizacao', () => {
  function fluxoComLocalizacao(): Pick<Fluxo, 'nodes' | 'edges'> {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'pede-local', tipo: 'solicitar_localizacao', texto: 'Pode compartilhar sua localização?', variavel: 'localizacao' }),
      no({ id: 'fim', tipo: 'fim' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'pede-local' }),
      aresta({ id: 'e2', origem: 'pede-local', destino: 'fim' }),
    ]
    return { nodes, edges }
  }

  it('para no nó e gera uma ação "localizacao" (não "texto") pra virar o botão nativo de compartilhar local', () => {
    expect(iniciarFluxo(fluxoComLocalizacao())).toEqual({
      acao: 'enviar_e_aguardar',
      acoes: [{ tipo: 'localizacao', texto: 'Pode compartilhar sua localização?' }],
      noId: 'pede-local',
    })
  })

  it('aceita qualquer resposta (como coleta) e segue em frente', () => {
    const resultado = continuarFluxo(fluxoComLocalizacao(), 'pede-local', '📍 https://www.google.com/maps?q=-23.5,-46.6')
    expect(resultado).toEqual({ acao: 'encerrar', acoes: [] })
  })
})

describe('pacote "lógica e variáveis"', () => {
  function fluxoComUmNoAutomatico(noAutomatico: FluxoNode): Pick<Fluxo, 'nodes' | 'edges'> {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), noAutomatico, no({ id: 'fim', tipo: 'fim' })]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: noAutomatico.id }),
      aresta({ id: 'e2', origem: noAutomatico.id, destino: 'fim' }),
    ]
    return { nodes, edges }
  }

  it('definir_variavel gera uma ação "variavel" e segue', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'set', tipo: 'definir_variavel', variavel: 'origem', texto: 'instagram' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'variavel', chave: 'origem', valor: 'instagram' }] })
  })

  it('definir_variavel sem chave não gera ação (mas segue em frente)', () => {
    const grafo = fluxoComUmNoAutomatico(no({ id: 'set', tipo: 'definir_variavel', texto: 'valor sem chave' }))
    expect(iniciarFluxo(grafo)).toEqual({ acao: 'encerrar', acoes: [] })
  })

  it('pausar gera uma ação "pausa" só quando tem segundos configurados', () => {
    const comPausa = fluxoComUmNoAutomatico(no({ id: 'pausa', tipo: 'pausar', pausaSegundos: 5 }))
    expect(iniciarFluxo(comPausa)).toEqual({ acao: 'encerrar', acoes: [{ tipo: 'pausa', segundos: 5 }] })

    const semPausa = fluxoComUmNoAutomatico(no({ id: 'pausa', tipo: 'pausar' }))
    expect(iniciarFluxo(semPausa)).toEqual({ acao: 'encerrar', acoes: [] })
  })

  /** condicao_variavel -> (verdadeiro) fim-v / (falso) fim-f, checando se "idade" > 18. */
  function fluxoComCondicao(): Pick<Fluxo, 'nodes' | 'edges'> {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'cond', tipo: 'condicao_variavel', variavel: 'idade', operador: 'maior', valorComparacao: '18' }),
      no({ id: 'maior-idade', tipo: 'encaminhar_humano', setor: 'Maiores' }),
      no({ id: 'menor-idade', tipo: 'encaminhar_humano', setor: 'Menores' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'cond' }),
      aresta({ id: 'e2', origem: 'cond', destino: 'maior-idade', opcaoId: 'verdadeiro' }),
      aresta({ id: 'e3', origem: 'cond', destino: 'menor-idade', opcaoId: 'falso' }),
    ]
    return { nodes, edges }
  }

  it('condicao_variavel segue pro caminho "verdadeiro" quando a condição bate', () => {
    const resultado = iniciarFluxo(fluxoComCondicao(), new Date(), { idade: '25' })
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: 'Maiores', motivo: undefined })
  })

  it('condicao_variavel segue pro caminho "falso" quando a condição não bate', () => {
    const resultado = iniciarFluxo(fluxoComCondicao(), new Date(), { idade: '10' })
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: 'Menores', motivo: undefined })
  })

  it('condicao_variavel trata a chave nunca coletada como "falso" pra operadores que exigem valor', () => {
    const resultado = iniciarFluxo(fluxoComCondicao(), new Date(), {})
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: 'Menores', motivo: undefined })
  })

  it('condicao_variavel sem operador definido cai sempre no caminho "falso"', () => {
    const grafo = fluxoComCondicao()
    grafo.nodes = grafo.nodes.map((n) => (n.id === 'cond' ? { ...n, operador: undefined } : n))
    const resultado = iniciarFluxo(grafo, new Date(), { idade: '99' })
    expect(resultado).toEqual({ acao: 'encaminhar_humano', acoes: [], setor: 'Menores', motivo: undefined })
  })

  it('condicao_variavel cai pra IA se o caminho calculado não tem aresta', () => {
    const grafo = fluxoComCondicao()
    grafo.edges = grafo.edges.filter((e) => e.opcaoId !== 'falso')
    const resultado = iniciarFluxo(grafo, new Date(), { idade: '5' })
    expect(resultado.acao).toBe('encaminhar_ia')
  })

  it('um "definir_variavel" logo antes de uma "condicao_variavel" já é visto por ela, na mesma passagem', () => {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'set', tipo: 'definir_variavel', variavel: 'vip', texto: 'sim' }),
      no({ id: 'cond', tipo: 'condicao_variavel', variavel: 'vip', operador: 'igual', valorComparacao: 'sim' }),
      no({ id: 'fila-vip', tipo: 'encaminhar_humano', setor: 'VIP' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'set' }),
      aresta({ id: 'e2', origem: 'set', destino: 'cond' }),
      aresta({ id: 'e3', origem: 'cond', destino: 'fila-vip', opcaoId: 'verdadeiro' }),
    ]
    const resultado = iniciarFluxo({ nodes, edges })
    expect(resultado).toEqual({
      acao: 'encaminhar_humano',
      acoes: [{ tipo: 'variavel', chave: 'vip', valor: 'sim' }],
      setor: 'VIP',
      motivo: undefined,
    })
  })
})

describe('nó "ir_para_fluxo"', () => {
  it('encerra este fluxo com a ação "ir_para_fluxo" e o id do destino, sem seguir por nenhuma aresta local', () => {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'saudacao', tipo: 'mensagem', texto: 'Oi!' }),
      no({ id: 'pula', tipo: 'ir_para_fluxo', fluxoDestinoId: 'fluxo-b' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'saudacao' }),
      aresta({ id: 'e2', origem: 'saudacao', destino: 'pula' }),
    ]
    const resultado = iniciarFluxo({ nodes, edges })
    expect(resultado).toEqual({
      acao: 'ir_para_fluxo',
      acoes: [{ tipo: 'texto', texto: 'Oi!' }],
      fluxoDestinoId: 'fluxo-b',
    })
  })

  it('sem destino configurado, encerra em vez de travar', () => {
    const nodes: FluxoNode[] = [no({ id: 'inicio', tipo: 'inicio' }), no({ id: 'pula', tipo: 'ir_para_fluxo' })]
    const edges: FluxoEdge[] = [aresta({ id: 'e1', origem: 'inicio', destino: 'pula' })]
    expect(iniciarFluxo({ nodes, edges })).toEqual({ acao: 'encerrar', acoes: [] })
  })
})

describe('nó "mover_etapa_funil"', () => {
  it('acumula a ação "etapa_funil" e segue pra próxima aresta, como um nó automático', () => {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'move', tipo: 'mover_etapa_funil', etapaFunilId: 'negociacao' }),
      no({ id: 'ia', tipo: 'encaminhar_ia' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'move' }),
      aresta({ id: 'e2', origem: 'move', destino: 'ia' }),
    ]
    expect(iniciarFluxo({ nodes, edges })).toEqual({
      acao: 'encaminhar_ia',
      acoes: [{ tipo: 'etapa_funil', etapaId: 'negociacao' }],
    })
  })

  it('sem etapa configurada, não gera ação e só segue em frente', () => {
    const nodes: FluxoNode[] = [
      no({ id: 'inicio', tipo: 'inicio' }),
      no({ id: 'move', tipo: 'mover_etapa_funil' }),
      no({ id: 'ia', tipo: 'encaminhar_ia' }),
    ]
    const edges: FluxoEdge[] = [
      aresta({ id: 'e1', origem: 'inicio', destino: 'move' }),
      aresta({ id: 'e2', origem: 'move', destino: 'ia' }),
    ]
    expect(iniciarFluxo({ nodes, edges })).toEqual({ acao: 'encaminhar_ia', acoes: [] })
  })
})
