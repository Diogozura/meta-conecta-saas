'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Loader2, Pencil, Copy, Trash2, Power, Workflow } from 'lucide-react'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import type { Fluxo } from '@/types/database'

const NO_INICIO_PADRAO = { id: 'inicio', tipo: 'inicio' as const, posicao: { x: 40, y: 40 } }

export default function FluxoListaPage() {
  const router = useRouter()
  const [fluxos, setFluxos] = useState<Fluxo[]>([])
  const [loading, setLoading] = useState(true)
  const [criando, setCriando] = useState(false)
  const [acaoEmAndamentoId, setAcaoEmAndamentoId] = useState<string | null>(null)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  async function carregar() {
    try {
      const res = await fetch('/api/fluxo')
      if (!res.ok) throw new Error('Erro ao carregar fluxos')
      const data = (await res.json()) as { fluxos: Fluxo[] }
      setFluxos(data.fluxos)
    } catch {
      toast.error('Erro ao carregar os fluxos de atendimento.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    carregar()
  }, [])

  async function handleCriar() {
    setCriando(true)
    try {
      const res = await fetch('/api/fluxo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: 'Novo fluxo', ativo: false, nodes: [NO_INICIO_PADRAO], edges: [] }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar fluxo')
      router.push(`/dashboard/conversas/fluxo/${json.fluxo.id}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar fluxo')
      setCriando(false)
    }
  }

  async function handleDuplicar(fluxo: Fluxo) {
    setAcaoEmAndamentoId(fluxo.id)
    try {
      const res = await fetch('/api/fluxo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: `${fluxo.nome} (cópia)`, ativo: false, nodes: fluxo.nodes, edges: fluxo.edges }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao duplicar fluxo')
      toast.success('Fluxo duplicado.')
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao duplicar fluxo')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function handleExcluir(fluxo: Fluxo) {
    if (!(await confirm(`Excluir o fluxo "${fluxo.nome}"? Essa ação não pode ser desfeita.`))) return
    setAcaoEmAndamentoId(fluxo.id)
    try {
      const res = await fetch(`/api/fluxo/${fluxo.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao excluir fluxo')
      setFluxos((prev) => prev.filter((f) => f.id !== fluxo.id))
      toast.success('Fluxo removido.')
    } catch {
      toast.error('Erro ao excluir fluxo')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  async function handleAlternarAtivo(fluxo: Fluxo) {
    setAcaoEmAndamentoId(fluxo.id)
    try {
      if (fluxo.ativo) {
        // "Desligar" o único fluxo ativo não tem um endpoint próprio — salva
        // o mesmo conteúdo com ativo=false, que é o que o editor também faz.
        const res = await fetch(`/api/fluxo/${fluxo.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nome: fluxo.nome, ativo: false, nodes: fluxo.nodes, edges: fluxo.edges }),
        })
        if (!res.ok) throw new Error('Erro ao desativar fluxo')
      } else {
        const res = await fetch(`/api/fluxo/${fluxo.id}/ativar`, { method: 'POST' })
        if (!res.ok) throw new Error('Erro ao ativar fluxo')
      }
      toast.success(fluxo.ativo ? 'Fluxo desativado — mensagens voltam a ir direto pra IA.' : `"${fluxo.nome}" está ativo agora.`)
      await carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar o fluxo')
    } finally {
      setAcaoEmAndamentoId(null)
    }
  }

  return (
    <div className="space-y-4">
      {ConfirmDialogElement}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/conversas" className="p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors" aria-label="Voltar pra conversas">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex items-center gap-2">
          <Workflow className="w-5 h-5 text-brand-600" />
          <h1 className="text-lg font-bold text-ink-900">Fluxos de atendimento</h1>
        </div>
        <button
          onClick={handleCriar}
          disabled={criando}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {criando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Novo fluxo
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-ink-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : fluxos.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-10 text-center">
          <p className="text-sm text-ink-400">
            Nenhum fluxo criado ainda. Sem um fluxo ativo, as mensagens vão direto pro agente de IA — do jeito que já funciona hoje.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {fluxos.map((fluxo) => (
            <div key={fluxo.id} className="bg-white rounded-xl border border-ink-200 p-4 flex flex-col gap-3 hover:border-ink-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 truncate">{fluxo.nome}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{fluxo.nodes.length} nó(s) · atualizado {new Date(fluxo.dataAtualizacao).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${fluxo.ativo ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>
                  {fluxo.ativo ? 'Ativo' : 'Rascunho'}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-ink-100">
                <button
                  onClick={() => handleAlternarAtivo(fluxo)}
                  disabled={acaoEmAndamentoId === fluxo.id}
                  title={fluxo.ativo ? 'Desativar' : 'Ativar este fluxo (desliga qualquer outro ativo)'}
                  className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg transition-colors disabled:opacity-50 ${
                    fluxo.ativo ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-ink-500 bg-ink-50 hover:bg-ink-100'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {fluxo.ativo ? 'Ativo' : 'Ativar'}
                </button>
                <div className="flex items-center gap-1">
                  <Link href={`/dashboard/conversas/fluxo/${fluxo.id}`} className="p-1.5 text-ink-400 hover:text-brand-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </Link>
                  <button onClick={() => handleDuplicar(fluxo)} disabled={acaoEmAndamentoId === fluxo.id} className="p-1.5 text-ink-400 hover:text-brand-600 transition-colors disabled:opacity-50" title="Duplicar">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleExcluir(fluxo)} disabled={acaoEmAndamentoId === fluxo.id} className="p-1.5 text-ink-400 hover:text-red-600 transition-colors disabled:opacity-50" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
