'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ArrowLeft, Plus, Save, Trash2, Loader2, Power } from 'lucide-react'
import { NODE_TYPES, TIPO_INFO, type FluxoRFNode } from '@/components/fluxo/FluxoNodes'
import type { Fluxo, FluxoNode, FluxoEdge as FluxoEdgeData, FluxoNodeTipo } from '@/types/database'

const TIPOS_ADICIONAVEIS: FluxoNodeTipo[] = [
  'mensagem', 'menu', 'horario', 'coleta', 'encaminhar_ia', 'encaminhar_humano', 'fim',
  'enviar_template', 'enviar_url', 'enviar_email', 'nota_interna', 'solicitar_localizacao', 'gerar_qrcode', 'adicionar_etiqueta', 'gerar_protocolo',
  'definir_variavel', 'condicao_variavel', 'pausar',
]

const HORARIO_PADRAO = { diasSemana: [false, true, true, true, true, true, false], horaInicio: '09:00', horaFim: '18:00' }
const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const OPERADORES_CONDICAO: { value: string; label: string; precisaComparacao: boolean }[] = [
  { value: 'igual', label: 'é igual a', precisaComparacao: true },
  { value: 'diferente', label: 'é diferente de', precisaComparacao: true },
  { value: 'contem', label: 'contém', precisaComparacao: true },
  { value: 'maior', label: 'é maior que (número)', precisaComparacao: true },
  { value: 'menor', label: 'é menor que (número)', precisaComparacao: true },
  { value: 'vazio', label: 'está vazio', precisaComparacao: false },
  { value: 'preenchido', label: 'está preenchido', precisaComparacao: false },
]

function novoId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `no-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function fluxoNodeParaRF(n: FluxoNode): FluxoRFNode {
  return { id: n.id, type: n.tipo, position: n.posicao, data: { ...n }, deletable: n.tipo !== 'inicio' }
}

function fluxoEdgeParaRF(e: FluxoEdgeData): Edge {
  return { id: e.id, source: e.origem, target: e.destino, sourceHandle: e.opcaoId ?? null, type: 'smoothstep' }
}

function rfParaFluxoNode(n: FluxoRFNode): FluxoNode {
  return {
    id: n.id,
    tipo: n.type as FluxoNodeTipo,
    posicao: n.position,
    texto: n.data.texto,
    opcoes: n.data.opcoes,
    horario: n.data.horario,
    variavel: n.data.variavel,
    setor: n.data.setor,
    motivo: n.data.motivo,
    templateNome: n.data.templateNome,
    url: n.data.url,
    botaoLabel: n.data.botaoLabel,
    emailDestinatario: n.data.emailDestinatario,
    emailAssunto: n.data.emailAssunto,
    estiloNota: n.data.estiloNota,
    etiqueta: n.data.etiqueta,
    operador: n.data.operador,
    valorComparacao: n.data.valorComparacao,
    pausaSegundos: n.data.pausaSegundos,
  }
}

function rfParaFluxoEdge(e: Edge): FluxoEdgeData {
  return { id: e.id, origem: e.source, destino: e.target, opcaoId: e.sourceHandle ?? undefined }
}

export default function FluxoEditorPage() {
  const params = useParams<{ id: string }>()
  const fluxoId = params.id

  const [loading, setLoading] = useState(true)
  const [naoEncontrado, setNaoEncontrado] = useState(false)
  const [saving, setSaving] = useState(false)
  const [ativando, setAtivando] = useState(false)
  const [nome, setNome] = useState('Fluxo de atendimento')
  const [ativo, setAtivo] = useState(false)
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<FluxoRFNode>([])
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<{ name: string; status: string }[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/fluxo/${fluxoId}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((data: { fluxo: Fluxo }) => {
        if (cancelled) return
        setNome(data.fluxo.nome)
        setAtivo(data.fluxo.ativo)
        setNodes(data.fluxo.nodes.map(fluxoNodeParaRF))
        setEdges(data.fluxo.edges.map(fluxoEdgeParaRF))
      })
      .catch(() => {
        if (!cancelled) setNaoEncontrado(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só roda uma vez ao montar, pro id da URL
  }, [fluxoId])

  const onNodesChange = useCallback(
    (changes: NodeChange<FluxoRFNode>[]) => {
      const permitidas = changes.filter((c) => !(c.type === 'remove' && nodes.find((n) => n.id === c.id)?.type === 'inicio'))
      onNodesChangeBase(permitidas)
      const removidos = permitidas.filter((c) => c.type === 'remove').map((c) => c.id)
      if (removidos.length) {
        setEdges((eds) => eds.filter((e) => !removidos.includes(e.source) && !removidos.includes(e.target)))
        setSelectedNodeId((prev) => (prev && removidos.includes(prev) ? null : prev))
      }
    },
    [nodes, onNodesChangeBase, setEdges]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => {
        // No máximo 1 aresta saindo de cada handle (cada opção de menu, cada
        // lado do horário, ou a única saída de um nó de mensagem) — conectar
        // de novo substitui a anterior.
        const semAntiga = eds.filter((e) => !(e.source === connection.source && (e.sourceHandle ?? null) === (connection.sourceHandle ?? null)))
        return addEdge({ ...connection, id: `e-${novoId()}`, type: 'smoothstep' }, semAntiga)
      })
    },
    [setEdges]
  )

  function adicionarNo(tipo: FluxoNodeTipo) {
    const id = novoId()
    const offset = nodes.length
    const novo: FluxoRFNode = {
      id,
      type: tipo,
      position: { x: 320 + (offset % 3) * 280, y: 40 + Math.floor(offset / 3) * 180 },
      data: { id, tipo, posicao: { x: 0, y: 0 }, ...(tipo === 'menu' ? { opcoes: [] } : {}), ...(tipo === 'horario' ? { horario: { ...HORARIO_PADRAO } } : {}) },
      deletable: true,
    }
    setNodes((nds) => [...nds, novo])
    setSelectedNodeId(id)
  }

  function atualizarDadosDoNo(id: string, patch: Partial<FluxoNode>) {
    setNodes((nds) => nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)))
  }

  function excluirNoSelecionado() {
    if (!selectedNodeId) return
    const no = nodes.find((n) => n.id === selectedNodeId)
    if (no?.type === 'inicio') return
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId))
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId))
    setSelectedNodeId(null)
  }

  async function handleSalvar() {
    if (!nome.trim()) {
      toast.error('Dê um nome pro fluxo antes de salvar.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/fluxo/${fluxoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          ativo,
          nodes: nodes.map(rfParaFluxoNode),
          edges: edges.map(rfParaFluxoEdge),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar o fluxo')
      toast.success('Fluxo salvo.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar o fluxo')
    } finally {
      setSaving(false)
    }
  }

  async function handleAtivar() {
    setAtivando(true)
    try {
      const res = await fetch(`/api/fluxo/${fluxoId}/ativar`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao ativar o fluxo')
      setAtivo(true)
      toast.success('Fluxo ativado — desligou qualquer outro que estivesse rodando.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao ativar o fluxo')
    } finally {
      setAtivando(false)
    }
  }

  const noSelecionado = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) : null

  useEffect(() => {
    if (noSelecionado?.type !== 'enviar_template' || templates !== null) return
    fetch('/api/meta/list-templates')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { templates: { name: string; status: string }[] }) => setTemplates(data.templates))
      // Falha vira lista vazia (mostra aviso no painel) — carregamento sob demanda não pode travar o editor.
      .catch(() => setTemplates([]))
  }, [noSelecionado?.type, templates])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-7rem)] text-ink-400">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando fluxo...
      </div>
    )
  }

  if (naoEncontrado) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-7rem)] gap-3 text-center">
        <p className="text-sm text-ink-500">Esse fluxo não existe (ou foi removido).</p>
        <Link href="/dashboard/conversas/fluxo" className="text-sm font-medium text-brand-700 hover:underline">
          Voltar pra lista de fluxos
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/dashboard/conversas/fluxo" className="p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors" aria-label="Voltar pra lista de fluxos">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome do fluxo"
          className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm font-semibold text-ink-900 min-w-0 flex-1 max-w-xs"
        />
        {ativo ? (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
            <Power className="w-3.5 h-3.5" /> Ativo
          </span>
        ) : (
          <button
            onClick={handleAtivar}
            disabled={ativando}
            className="flex items-center gap-1 text-xs font-medium text-ink-500 bg-ink-100 hover:bg-ink-200 px-2.5 py-1 rounded-full disabled:opacity-50 transition-colors"
            title="Ativa este fluxo e desliga qualquer outro que estivesse ativo"
          >
            {ativando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
            Ativar
          </button>
        )}
        <button
          onClick={handleSalvar}
          disabled={saving}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          Salvar
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {TIPOS_ADICIONAVEIS.map((tipo) => {
          const info = TIPO_INFO[tipo]
          const Icon = info.icon
          return (
            <button
              key={tipo}
              onClick={() => adicionarNo(tipo)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${info.corBorda} ${info.corFundo} ${info.corTexto} hover:brightness-95 transition-all`}
            >
              <Plus className="w-3 h-3" />
              <Icon className="w-3.5 h-3.5" />
              {info.label}
            </button>
          )
        })}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        <div className="flex-1 rounded-xl border border-ink-200 overflow-hidden bg-ink-50">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChangeBase}
            onConnect={onConnect}
            onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            nodeTypes={NODE_TYPES}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable className="!bg-white" />
          </ReactFlow>
        </div>

        {noSelecionado && (
          <div className="w-72 shrink-0 bg-white rounded-xl border border-ink-200 p-4 overflow-y-auto space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-ink-900">{TIPO_INFO[noSelecionado.type as FluxoNodeTipo].label}</p>
              {noSelecionado.type !== 'inicio' && (
                <button onClick={excluirNoSelecionado} className="p-1 text-ink-400 hover:text-red-600 transition-colors" title="Excluir nó">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {(noSelecionado.type === 'mensagem' || noSelecionado.type === 'menu' || noSelecionado.type === 'coleta') && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">{noSelecionado.type === 'coleta' ? 'Pergunta' : 'Texto da mensagem'}</label>
                <textarea
                  value={noSelecionado.data.texto ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                  rows={4}
                  placeholder="O que o cliente vai receber…"
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                />
              </div>
            )}

            {noSelecionado.type === 'coleta' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Guardar resposta em (chave)</label>
                <input
                  value={noSelecionado.data.variavel ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { variavel: e.target.value.trim() })}
                  placeholder="Ex: cpf, nome, protocolo..."
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                />
                <p className="text-[11px] text-ink-400 mt-1">Aceita qualquer resposta do cliente (não é um menu de opções) — o valor fica disponível pro atendente e pro agente de IA depois.</p>
              </div>
            )}

            {noSelecionado.type === 'menu' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Opções (o que o cliente precisa digitar)</label>
                <div className="space-y-1.5">
                  {(noSelecionado.data.opcoes ?? []).map((op, i) => (
                    <div key={op.id} className="flex items-center gap-1.5">
                      <input
                        value={op.rotulo}
                        onChange={(e) => {
                          const opcoes = [...(noSelecionado.data.opcoes ?? [])]
                          opcoes[i] = { ...op, rotulo: e.target.value }
                          atualizarDadosDoNo(noSelecionado.id, { opcoes })
                        }}
                        placeholder="Ex: 1"
                        className="flex-1 min-w-0 px-2 py-1.5 border border-ink-200 rounded-lg text-xs"
                      />
                      <button
                        onClick={() => {
                          const opcoes = (noSelecionado.data.opcoes ?? []).filter((o) => o.id !== op.id)
                          atualizarDadosDoNo(noSelecionado.id, { opcoes })
                          setEdges((eds) => eds.filter((e) => !(e.source === noSelecionado.id && e.sourceHandle === op.id)))
                        }}
                        className="p-1.5 text-ink-400 hover:text-red-600 transition-colors shrink-0"
                        title="Remover opção"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => {
                      const opcoes = [...(noSelecionado.data.opcoes ?? []), { id: novoId(), rotulo: '' }]
                      atualizarDadosDoNo(noSelecionado.id, { opcoes })
                    }}
                    className="flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
                  >
                    <Plus className="w-3 h-3" /> Adicionar opção
                  </button>
                </div>
                <p className="text-[11px] text-ink-400 mt-2">Arraste do quadradinho de cada opção até o próximo nó pra ligar o caminho dela.</p>
              </div>
            )}

            {noSelecionado.type === 'horario' && (
              <div className="space-y-2">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Dias de atendimento</label>
                  <div className="flex gap-1">
                    {DIAS_SEMANA_ABREV.map((d, i) => {
                      const h = noSelecionado.data.horario ?? HORARIO_PADRAO
                      const ativoDia = h.diasSemana[i]
                      return (
                        <button
                          key={i}
                          type="button"
                          title={d}
                          onClick={() => {
                            const diasSemana = [...h.diasSemana]
                            diasSemana[i] = !diasSemana[i]
                            atualizarDadosDoNo(noSelecionado.id, { horario: { ...h, diasSemana } })
                          }}
                          className={`w-7 h-7 rounded-full text-[10px] font-semibold transition-colors ${
                            ativoDia ? 'bg-cyan-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                          }`}
                        >
                          {d[0]}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-ink-600 mb-1">Início</label>
                    <input
                      type="time"
                      value={(noSelecionado.data.horario ?? HORARIO_PADRAO).horaInicio}
                      onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { horario: { ...(noSelecionado.data.horario ?? HORARIO_PADRAO), horaInicio: e.target.value } })}
                      className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-ink-600 mb-1">Fim</label>
                    <input
                      type="time"
                      value={(noSelecionado.data.horario ?? HORARIO_PADRAO).horaFim}
                      onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { horario: { ...(noSelecionado.data.horario ?? HORARIO_PADRAO), horaFim: e.target.value } })}
                      className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-ink-400">Horário de Brasília. Ligue &quot;Dentro do horário&quot; e &quot;Fora do horário&quot; a caminhos diferentes.</p>
              </div>
            )}

            {noSelecionado.type === 'encaminhar_humano' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Setor / departamento (opcional)</label>
                  <input
                    value={noSelecionado.data.setor ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { setor: e.target.value })}
                    placeholder="Ex: Suporte técnico, Financeiro, Vendas..."
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Aparece na fila de atendimento do painel — deixe em branco pra cair na fila geral.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Motivo mostrado ao atendente (opcional)</label>
                  <input
                    value={noSelecionado.data.motivo ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { motivo: e.target.value })}
                    placeholder="Ex: Cliente pediu cancelamento"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
              </>
            )}

            {noSelecionado.type === 'enviar_template' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Template aprovado</label>
                {templates === null ? (
                  <p className="text-xs text-ink-400 flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando templates...</p>
                ) : templates.length === 0 ? (
                  <p className="text-[11px] text-ink-400">
                    Nenhum template encontrado. Crie um em{' '}
                    <Link href="/dashboard/templates" className="text-brand-700 hover:underline">Configurações → Templates</Link>.
                  </p>
                ) : (
                  <select
                    value={noSelecionado.data.templateNome ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { templateNome: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  >
                    <option value="">Selecione...</option>
                    {templates.map((t) => (
                      <option key={t.name} value={t.name} disabled={t.status !== 'APPROVED'}>
                        {t.name} {t.status !== 'APPROVED' ? `(${t.status})` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-ink-400 mt-1">Envia sem variáveis — o template precisa funcionar só com o texto fixo aprovado.</p>
              </div>
            )}

            {noSelecionado.type === 'enviar_url' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Texto da mensagem</label>
                  <textarea
                    value={noSelecionado.data.texto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                    rows={3}
                    placeholder="Ex: Aqui está o link que você pediu:"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">URL</label>
                  <input
                    value={noSelecionado.data.url ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { url: e.target.value.trim() })}
                    placeholder="https://..."
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Rótulo do botão</label>
                  <input
                    value={noSelecionado.data.botaoLabel ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { botaoLabel: e.target.value.slice(0, 20) })}
                    placeholder="Ex: Ver mais"
                    maxLength={20}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
              </>
            )}

            {noSelecionado.type === 'enviar_email' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Destinatário</label>
                  <input
                    value={noSelecionado.data.emailDestinatario ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { emailDestinatario: e.target.value })}
                    placeholder="email@empresa.com ou {{email}}"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Pode usar {'{{chave}}'} pra referenciar um dado coletado antes no fluxo (ex: um nó &quot;Coletar dado&quot; que guardou o e-mail do cliente).</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Assunto</label>
                  <input
                    value={noSelecionado.data.emailAssunto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { emailAssunto: e.target.value })}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Corpo</label>
                  <textarea
                    value={noSelecionado.data.texto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                  />
                </div>
              </>
            )}

            {noSelecionado.type === 'nota_interna' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Conteúdo da nota</label>
                  <textarea
                    value={noSelecionado.data.texto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                    rows={3}
                    placeholder="Só o atendente vê isso — nunca vai pro WhatsApp"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                  />
                </div>
                <div className="flex gap-2">
                  {(['info', 'alerta'] as const).map((estilo) => (
                    <button
                      key={estilo}
                      onClick={() => atualizarDadosDoNo(noSelecionado.id, { estiloNota: estilo })}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        (noSelecionado.data.estiloNota ?? 'info') === estilo
                          ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                          : 'bg-white border-ink-200 text-ink-500 hover:bg-ink-50'
                      }`}
                    >
                      {estilo === 'info' ? 'ℹ️ Informação' : '⚠️ Alerta'}
                    </button>
                  ))}
                </div>
              </>
            )}

            {noSelecionado.type === 'solicitar_localizacao' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Texto do pedido</label>
                  <textarea
                    value={noSelecionado.data.texto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                    rows={3}
                    placeholder="Ex: Pode compartilhar sua localização?"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Guardar em (chave)</label>
                  <input
                    value={noSelecionado.data.variavel ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { variavel: e.target.value.trim() })}
                    placeholder="Ex: localizacao"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
              </>
            )}

            {noSelecionado.type === 'gerar_qrcode' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Conteúdo do QR code</label>
                <textarea
                  value={noSelecionado.data.texto ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                  rows={3}
                  placeholder="Um link, um código PIX, texto livre..."
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none font-mono"
                />
                <p className="text-[11px] text-ink-400 mt-1">Aceita {'{{chave}}'} pra usar um dado coletado antes no fluxo.</p>
              </div>
            )}

            {noSelecionado.type === 'adicionar_etiqueta' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Etiqueta</label>
                <input
                  value={noSelecionado.data.etiqueta ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { etiqueta: e.target.value })}
                  placeholder="Ex: Lead quente, Reclamação..."
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                />
                <p className="text-[11px] text-ink-400 mt-1">Aparece na conversa, no painel — não é enviada pro cliente.</p>
              </div>
            )}

            {noSelecionado.type === 'gerar_protocolo' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Mensagem pro cliente (opcional)</label>
                <textarea
                  value={noSelecionado.data.texto ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                  rows={3}
                  placeholder="Ex: Seu protocolo é {{protocolo}} — guarde pra referência futura."
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm resize-none"
                />
                <p className="text-[11px] text-ink-400 mt-1">Deixe em branco pra só gerar e guardar o protocolo, sem avisar o cliente. Use {'{{protocolo}}'} no texto pra incluir o número gerado.</p>
              </div>
            )}

            {noSelecionado.type === 'definir_variavel' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Chave</label>
                  <input
                    value={noSelecionado.data.variavel ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { variavel: e.target.value.trim() })}
                    placeholder="Ex: origem_lead"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Valor</label>
                  <input
                    value={noSelecionado.data.texto ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { texto: e.target.value })}
                    placeholder="Ex: instagram, ou {{outra_chave}}"
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                  <p className="text-[11px] text-ink-400 mt-1">Aceita {'{{chave}}'} pra copiar/combinar outro dado já coletado no fluxo.</p>
                </div>
              </>
            )}

            {noSelecionado.type === 'condicao_variavel' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Chave a checar</label>
                  <input
                    value={noSelecionado.data.variavel ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { variavel: e.target.value.trim() })}
                    placeholder="Ex: idade, cpf, origem_lead..."
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Condição</label>
                  <select
                    value={noSelecionado.data.operador ?? ''}
                    onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { operador: (e.target.value || undefined) as FluxoNode['operador'] })}
                    className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                  >
                    <option value="">Selecione...</option>
                    {OPERADORES_CONDICAO.map((op) => (
                      <option key={op.value} value={op.value}>{op.label}</option>
                    ))}
                  </select>
                </div>
                {OPERADORES_CONDICAO.find((op) => op.value === noSelecionado.data.operador)?.precisaComparacao && (
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Valor de comparação</label>
                    <input
                      value={noSelecionado.data.valorComparacao ?? ''}
                      onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { valorComparacao: e.target.value })}
                      className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                    />
                  </div>
                )}
                <p className="text-[11px] text-ink-400">Arraste do quadradinho &quot;Verdadeiro&quot;/&quot;Falso&quot; até o próximo nó de cada caminho.</p>
              </>
            )}

            {noSelecionado.type === 'pausar' && (
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Pausa (segundos)</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={noSelecionado.data.pausaSegundos ?? ''}
                  onChange={(e) => atualizarDadosDoNo(noSelecionado.id, { pausaSegundos: Number(e.target.value) || undefined })}
                  className="w-full px-3 py-2 border border-ink-200 rounded-lg text-sm"
                />
                <p className="text-[11px] text-ink-400 mt-1">Máximo de 60s — o fluxo roda numa função do servidor, não é um agendador de longo prazo.</p>
              </div>
            )}

            {noSelecionado.type === 'inicio' && <p className="text-xs text-ink-500">Ponto de partida — toda conversa nova entra por aqui. Conecte a um próximo passo.</p>}
            {noSelecionado.type === 'encaminhar_ia' && <p className="text-xs text-ink-500">A conversa passa a ser respondida pelo agente de IA configurado em Configurações.</p>}
            {noSelecionado.type === 'fim' && <p className="text-xs text-ink-500">Encerra a conversa (status &quot;Encerrada&quot; no painel).</p>}
          </div>
        )}
      </div>
    </div>
  )
}
