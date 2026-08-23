import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Fluxo, Conversa } from '@/types/database'

// fluxoService.ts é I/O puro (Firestore + Graph API da Meta) — mocka tudo
// que sai da função pura (fluxoEngine, canalWhatsapp, variaveisFluxo
// continuam reais) pra testar o encadeamento de ponta a ponta sem rede de
// verdade: webhook → motor → execução de cada ação → Firestore.
vi.mock('@/lib/firestore', () => ({
  obterFluxoAtivo: vi.fn(),
  obterFluxoPorId: vi.fn(),
  obterConversa: vi.fn(),
  obterMetaAccess: vi.fn(),
  criarMensagem: vi.fn().mockResolvedValue(undefined),
  atualizarFluxoConversa: vi.fn().mockResolvedValue(undefined),
  encaminharConversaParaFilaPeloFluxo: vi.fn().mockResolvedValue(undefined),
  encerrarConversa: vi.fn().mockResolvedValue(undefined),
  marcarConversaEmAndamento: vi.fn().mockResolvedValue(undefined),
  salvarDadoColetado: vi.fn().mockResolvedValue(undefined),
  adicionarEtiquetaConversa: vi.fn().mockResolvedValue(undefined),
  definirProtocoloConversa: vi.fn().mockResolvedValue(undefined),
  moverConversaEtapaFunil: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/meta', () => ({
  sendTextMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_texto' }] }),
  sendButtonsMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_botoes' }] }),
  sendListMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_lista' }] }),
  sendTemplateMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_template' }] }),
  sendCtaUrlMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_url' }] }),
  sendLocationRequestMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_local' }] }),
  uploadMediaToMeta: vi.fn().mockResolvedValue({ id: 'media_123' }),
  sendMediaMessage: vi.fn().mockResolvedValue({ messages: [{ id: 'wamid_midia' }] }),
}))

vi.mock('@/lib/csatService', () => ({
  enviarPedidoCsat: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/notificacoes', () => ({
  enviarEmail: vi.fn().mockResolvedValue(true),
}))

import { processarMensagemComFluxo } from './fluxoService'
import * as firestore from '@/lib/firestore'
import * as meta from '@/lib/meta'

const CONTA_ID = 'conta-1'
const NUMERO = '5511999999999'
const META_ACCESS = { id: 'ma1', wabaId: 'waba1', phoneNumberId: 'phone1', businessToken: 'token1', dataAtualizacao: new Date() }

/**
 * Fluxo de suporte com um pouco de cada pacote: inicio -> mensagem -> menu
 * (2 opções, vira botões nativos) -> [1: coleta -> definir_variavel ->
 * condicao_variavel -> (verdadeiro: nota_interna -> encaminhar_humano VIP;
 * falso: encaminhar_ia)] [2: encaminhar_humano Financeiro].
 */
function fluxoDeTeste(): Fluxo {
  return {
    id: 'fluxo1',
    contaId: CONTA_ID,
    nome: 'Fluxo de teste',
    ativo: true,
    dataCadastro: new Date(),
    dataAtualizacao: new Date(),
    nodes: [
      { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
      { id: 'boas-vindas', tipo: 'mensagem', posicao: { x: 0, y: 0 }, texto: 'Olá! Bem-vindo.' },
      {
        id: 'menu', tipo: 'menu', posicao: { x: 0, y: 0 },
        texto: 'Escolha: 1 Suporte, 2 Financeiro',
        opcoes: [{ id: 'op1', rotulo: '1' }, { id: 'op2', rotulo: '2' }],
      },
      { id: 'pede-nome', tipo: 'coleta', posicao: { x: 0, y: 0 }, texto: 'Qual seu nome?', variavel: 'nome' },
      { id: 'set-vip', tipo: 'definir_variavel', posicao: { x: 0, y: 0 }, variavel: 'vip', texto: 'sim' },
      { id: 'checa-vip', tipo: 'condicao_variavel', posicao: { x: 0, y: 0 }, variavel: 'vip', operador: 'igual', valorComparacao: 'sim' },
      { id: 'nota-vip', tipo: 'nota_interna', posicao: { x: 0, y: 0 }, texto: 'Cliente é VIP', estiloNota: 'alerta' },
      { id: 'humano-vip', tipo: 'encaminhar_humano', posicao: { x: 0, y: 0 }, setor: 'VIP' },
      { id: 'ia', tipo: 'encaminhar_ia', posicao: { x: 0, y: 0 } },
      { id: 'humano-financeiro', tipo: 'encaminhar_humano', posicao: { x: 0, y: 0 }, setor: 'Financeiro' },
    ],
    edges: [
      { id: 'e1', origem: 'inicio', destino: 'boas-vindas' },
      { id: 'e2', origem: 'boas-vindas', destino: 'menu' },
      { id: 'e3', origem: 'menu', destino: 'pede-nome', opcaoId: 'op1' },
      { id: 'e4', origem: 'menu', destino: 'humano-financeiro', opcaoId: 'op2' },
      { id: 'e5', origem: 'pede-nome', destino: 'set-vip' },
      { id: 'e6', origem: 'set-vip', destino: 'checa-vip' },
      { id: 'e7', origem: 'checa-vip', destino: 'nota-vip', opcaoId: 'verdadeiro' },
      { id: 'e8', origem: 'nota-vip', destino: 'humano-vip' },
      { id: 'e9', origem: 'checa-vip', destino: 'ia', opcaoId: 'falso' },
    ],
  }
}

function conversaParada(noAtualId: string | null, dadosColetados: Record<string, string> = {}): Conversa {
  return { numero: NUMERO, iaAtiva: !noAtualId, fluxoNoAtualId: noAtualId, dadosColetados }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(firestore.obterFluxoAtivo).mockResolvedValue(fluxoDeTeste())
  vi.mocked(firestore.obterMetaAccess).mockResolvedValue(META_ACCESS as never)
})

describe('processarMensagemComFluxo — primeiro contato', () => {
  it('percorre a mensagem de boas-vindas e para no menu, mandando o menu como botões nativos', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(null)

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi')

    expect(tratado).toBe(true)
    // Mensagem de boas-vindas sai como texto simples.
    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Olá! Bem-vindo.')
    // O menu (última ação, 2 opções) vira botões nativos, não texto nem lista.
    expect(meta.sendButtonsMessage).toHaveBeenCalledWith(
      'phone1', 'token1', NUMERO, 'Escolha: 1 Suporte, 2 Financeiro',
      [{ id: 'op1', title: '1' }, { id: 'op2', title: '2' }],
    )
    expect(meta.sendListMessage).not.toHaveBeenCalled()
    // Conversa marcada esperando resposta no nó do menu, presa no fluxo1.
    expect(firestore.atualizarFluxoConversa).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'menu', 'fluxo1')
    expect(firestore.marcarConversaEmAndamento).toHaveBeenCalledWith(CONTA_ID, NUMERO)
  })
})

describe('processarMensagemComFluxo — cliente escolhe "2" (Financeiro)', () => {
  it('encaminha direto pra fila humana do Financeiro, sem passar pela coleta', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(conversaParada('menu'))

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, '2')

    expect(tratado).toBe(true)
    expect(firestore.encaminharConversaParaFilaPeloFluxo).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'Financeiro', undefined)
    expect(meta.sendTextMessage).not.toHaveBeenCalled()
  })
})

describe('processarMensagemComFluxo — cliente escolhe "1" (Suporte) e é coletado o nome', () => {
  it('para no nó de coleta e pergunta o nome', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(conversaParada('menu'))

    await processarMensagemComFluxo(CONTA_ID, NUMERO, '1')

    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Qual seu nome?')
    expect(firestore.atualizarFluxoConversa).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'pede-nome', 'fluxo1')
  })

  it('depois de responder o nome, define vip=sim, avalia a condição como verdadeira, registra a nota interna e encaminha pro setor VIP', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(conversaParada('pede-nome'))

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'Maria')

    expect(tratado).toBe(true)
    // O nome respondido foi salvo em dadosColetados.nome.
    expect(firestore.salvarDadoColetado).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'nome', 'Maria')
    // definir_variavel gravou vip=sim.
    expect(firestore.salvarDadoColetado).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'vip', 'sim')
    // nota_interna NUNCA vira mensagem enviada — vira um registro tipo "nota".
    expect(firestore.criarMensagem).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'nota', text: 'Cliente é VIP', estiloNota: 'alerta', from: 'sistema' })
    )
    // A condição bateu (vip === 'sim') e foi pro setor VIP, não pra IA.
    expect(firestore.encaminharConversaParaFilaPeloFluxo).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'VIP', undefined)
  })
})

describe('processarMensagemComFluxo — opção inválida no menu', () => {
  it('repete o menu (com botões de novo) em vez de travar ou seguir em frente', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(conversaParada('menu'))

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, '9')

    expect(tratado).toBe(true)
    expect(meta.sendButtonsMessage).toHaveBeenCalledWith(
      'phone1', 'token1', NUMERO, 'Escolha: 1 Suporte, 2 Financeiro',
      [{ id: 'op1', title: '1' }, { id: 'op2', title: '2' }],
    )
    expect(firestore.atualizarFluxoConversa).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'menu', 'fluxo1')
  })
})

describe('processarMensagemComFluxo — conversa já saiu do fluxo', () => {
  it('não faz nada e devolve false, deixando o agente de IA de sempre responder', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue({ numero: NUMERO, iaAtiva: true, fluxoNoAtualId: '__saiu__' })

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi de novo')

    expect(tratado).toBe(false)
    expect(meta.sendTextMessage).not.toHaveBeenCalled()
    expect(firestore.atualizarFluxoConversa).not.toHaveBeenCalled()
  })
})

describe('processarMensagemComFluxo — sem fluxo ativo', () => {
  it('devolve false sem chamar nada de Meta além da checagem inicial', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(null)
    vi.mocked(firestore.obterFluxoAtivo).mockResolvedValue(null)

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi')

    expect(tratado).toBe(false)
    expect(meta.sendTextMessage).not.toHaveBeenCalled()
  })
})

describe('processarMensagemComFluxo — nó "mover_etapa_funil"', () => {
  it('move a conversa pra etapa do funil configurada no nó, sem gerar mensagem nenhuma pro cliente', async () => {
    const fluxo: Fluxo = {
      id: 'fluxo-crm',
      contaId: CONTA_ID,
      nome: 'Fluxo com CRM',
      ativo: true,
      dataCadastro: new Date(),
      dataAtualizacao: new Date(),
      nodes: [
        { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
        { id: 'move', tipo: 'mover_etapa_funil', posicao: { x: 0, y: 0 }, etapaFunilId: 'negociacao' },
        { id: 'humano', tipo: 'encaminhar_humano', posicao: { x: 0, y: 0 }, setor: 'Vendas' },
      ],
      edges: [
        { id: 'e1', origem: 'inicio', destino: 'move' },
        { id: 'e2', origem: 'move', destino: 'humano' },
      ],
    }
    vi.mocked(firestore.obterConversa).mockResolvedValue(null)
    vi.mocked(firestore.obterFluxoAtivo).mockResolvedValue(fluxo)

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi')

    expect(tratado).toBe(true)
    expect(firestore.moverConversaEtapaFunil).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'negociacao')
    expect(meta.sendTextMessage).not.toHaveBeenCalled()
    expect(firestore.encaminharConversaParaFilaPeloFluxo).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'Vendas', undefined)
  })
})

describe('processarMensagemComFluxo — nó "ir_para_fluxo" (salto pra outro fluxo)', () => {
  function fluxoA(): Fluxo {
    return {
      id: 'fluxo-a',
      contaId: CONTA_ID,
      nome: 'Fluxo A',
      ativo: true,
      dataCadastro: new Date(),
      dataAtualizacao: new Date(),
      nodes: [
        { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
        { id: 'msg-a', tipo: 'mensagem', posicao: { x: 0, y: 0 }, texto: 'Bem-vindo A' },
        { id: 'pula', tipo: 'ir_para_fluxo', posicao: { x: 0, y: 0 }, fluxoDestinoId: 'fluxo-b' },
      ],
      edges: [
        { id: 'e1', origem: 'inicio', destino: 'msg-a' },
        { id: 'e2', origem: 'msg-a', destino: 'pula' },
      ],
    }
  }

  function fluxoB(): Fluxo {
    return {
      id: 'fluxo-b',
      contaId: CONTA_ID,
      nome: 'Fluxo B',
      ativo: false,
      dataCadastro: new Date(),
      dataAtualizacao: new Date(),
      nodes: [
        { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
        { id: 'msg-b', tipo: 'mensagem', posicao: { x: 0, y: 0 }, texto: 'Oi da B' },
        {
          id: 'menu-b', tipo: 'menu', posicao: { x: 0, y: 0 },
          texto: 'Escolha X ou Y',
          opcoes: [{ id: 'x', rotulo: 'X' }, { id: 'y', rotulo: 'Y' }],
        },
      ],
      edges: [
        { id: 'e1', origem: 'inicio', destino: 'msg-b' },
        { id: 'e2', origem: 'msg-b', destino: 'menu-b' },
      ],
    }
  }

  it('termina o fluxo A e entra direto no fluxo B, mandando as mensagens dos dois em ordem e ficando "preso" no fluxo B (não no ativo da conta)', async () => {
    vi.mocked(firestore.obterConversa).mockResolvedValue(null)
    vi.mocked(firestore.obterFluxoAtivo).mockResolvedValue(fluxoA())
    vi.mocked(firestore.obterFluxoPorId).mockImplementation(async (_contaId, id) => (id === 'fluxo-b' ? fluxoB() : null))

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi')

    expect(tratado).toBe(true)
    expect(firestore.obterFluxoPorId).toHaveBeenCalledWith(CONTA_ID, 'fluxo-b')
    // Mensagem do fluxo A sai primeiro, depois a do fluxo B.
    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Bem-vindo A')
    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Oi da B')
    // O menu do fluxo B (última ação) vira botões nativos.
    expect(meta.sendButtonsMessage).toHaveBeenCalledWith(
      'phone1', 'token1', NUMERO, 'Escolha X ou Y',
      [{ id: 'x', title: 'X' }, { id: 'y', title: 'Y' }],
    )
    // Fica marcada no fluxo B (não no fluxo A, que era o ativo da conta).
    expect(firestore.atualizarFluxoConversa).toHaveBeenCalledWith(CONTA_ID, NUMERO, 'menu-b', 'fluxo-b')
  })

  it('detecta um ciclo (A leva pra B, B leva de volta pra A) e cai pra IA em vez de travar num loop infinito', async () => {
    const cicloA: Fluxo = {
      id: 'fluxo-a2',
      contaId: CONTA_ID,
      nome: 'Fluxo A2',
      ativo: true,
      dataCadastro: new Date(),
      dataAtualizacao: new Date(),
      nodes: [
        { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
        { id: 'msg-a', tipo: 'mensagem', posicao: { x: 0, y: 0 }, texto: 'Msg A' },
        { id: 'pula', tipo: 'ir_para_fluxo', posicao: { x: 0, y: 0 }, fluxoDestinoId: 'fluxo-b2' },
      ],
      edges: [
        { id: 'e1', origem: 'inicio', destino: 'msg-a' },
        { id: 'e2', origem: 'msg-a', destino: 'pula' },
      ],
    }
    const cicloB: Fluxo = {
      id: 'fluxo-b2',
      contaId: CONTA_ID,
      nome: 'Fluxo B2',
      ativo: false,
      dataCadastro: new Date(),
      dataAtualizacao: new Date(),
      nodes: [
        { id: 'inicio', tipo: 'inicio', posicao: { x: 0, y: 0 } },
        { id: 'msg-b', tipo: 'mensagem', posicao: { x: 0, y: 0 }, texto: 'Msg B' },
        { id: 'pula-volta', tipo: 'ir_para_fluxo', posicao: { x: 0, y: 0 }, fluxoDestinoId: 'fluxo-a2' },
      ],
      edges: [
        { id: 'e1', origem: 'inicio', destino: 'msg-b' },
        { id: 'e2', origem: 'msg-b', destino: 'pula-volta' },
      ],
    }
    vi.mocked(firestore.obterConversa).mockResolvedValue(null)
    vi.mocked(firestore.obterFluxoAtivo).mockResolvedValue(cicloA)
    vi.mocked(firestore.obterFluxoPorId).mockImplementation(async (_contaId, id) => {
      if (id === 'fluxo-b2') return cicloB
      if (id === 'fluxo-a2') return cicloA
      return null
    })

    const tratado = await processarMensagemComFluxo(CONTA_ID, NUMERO, 'oi')

    // Ciclo detectado -> cai pra IA (mesmo fallback de um ciclo dentro do
    // mesmo fluxo), não trava nem estoura um loop infinito.
    expect(tratado).toBe(false)
    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Msg A')
    expect(meta.sendTextMessage).toHaveBeenCalledWith('phone1', 'token1', NUMERO, 'Msg B')
    expect(firestore.atualizarFluxoConversa).toHaveBeenCalledWith(CONTA_ID, NUMERO, '__saiu__', null)
  })
})
