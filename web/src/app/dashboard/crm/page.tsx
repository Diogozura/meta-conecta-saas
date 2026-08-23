'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Plus, Settings2, Tag, Trash2, X } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import { etapaAtualId } from '@/lib/funil'

type FunilEtapa = { id: string; nome: string; cor: string }

type ConversaCrm = {
  numero: string
  status?: 'aberta' | 'em_andamento' | 'encerrada'
  prioridade?: 'normal' | 'alta' | 'urgente'
  etiquetas?: string[]
  protocolo?: string
  etapaFunilId?: string | null
}

const CORES_SUGERIDAS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#22c55e', '#ef4444', '#06b6d4', '#ec4899', '#64748b']

function formatarNumero(numero: string): string {
  const digitos = numero.replace(/\D/g, '')
  if (digitos.length < 10) return numero
  const ddi = digitos.slice(0, digitos.length - 10)
  const ddd = digitos.slice(-10, -8)
  const resto = digitos.slice(-8)
  return `+${ddi} (${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`
}

export default function CrmPage() {
  const [conversas, setConversas] = useState<ConversaCrm[] | null>(null)
  const [etapas, setEtapas] = useState<FunilEtapa[]>([])
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobreColuna, setSobreColuna] = useState<string | null>(null)
  const [gerenciarAberto, setGerenciarAberto] = useState(false)

  function carregar() {
    fetch('/api/crm/conversas')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { conversas: ConversaCrm[]; etapas: FunilEtapa[] }) => {
        setConversas(data.conversas)
        setEtapas(data.etapas)
      })
      .catch(() => toast.error('Erro ao carregar o funil'))
  }

  useEffect(() => {
    carregar()
  }, [])

  const colunas = useMemo(() => {
    const mapa = new Map<string, ConversaCrm[]>(etapas.map((e) => [e.id, []]))
    for (const c of conversas ?? []) {
      const id = etapaAtualId(c.etapaFunilId, etapas)
      mapa.get(id)?.push(c)
    }
    return etapas.map((etapa) => ({ etapa, conversas: mapa.get(etapa.id) ?? [] }))
  }, [conversas, etapas])

  async function moverPara(numero: string, etapaFunilId: string) {
    const conversaAtual = conversas?.find((c) => c.numero === numero)
    if (!conversaAtual || etapaAtualId(conversaAtual.etapaFunilId, etapas) === etapaFunilId) return

    setConversas((prev) => prev?.map((c) => (c.numero === numero ? { ...c, etapaFunilId } : c)) ?? null)
    try {
      const res = await fetch(`/api/crm/conversas/${encodeURIComponent(numero)}/etapa`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapaFunilId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setConversas((prev) => prev?.map((c) => (c.numero === numero ? conversaAtual : c)) ?? null)
      toast.error('Erro ao mover — tente de novo')
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ink-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ink-900">CRM</h1>
          <p className="text-sm text-ink-500 mt-0.5">Arraste os cards entre as etapas pra acompanhar seus leads e negociações.</p>
        </div>
        <button
          onClick={() => setGerenciarAberto(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-700 border border-ink-300 rounded-lg hover:bg-ink-50 transition-colors shrink-0"
        >
          <Settings2 className="w-4 h-4" />
          Etapas
        </button>
      </div>

      {conversas === null ? (
        <div className="flex gap-4 p-6 overflow-x-auto">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-96 w-72 shrink-0 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="flex-1 flex gap-4 p-6 overflow-x-auto">
          {colunas.map(({ etapa, conversas: itens }) => (
            <div
              key={etapa.id}
              onDragOver={(e) => {
                e.preventDefault()
                setSobreColuna(etapa.id)
              }}
              onDragLeave={() => setSobreColuna((atual) => (atual === etapa.id ? null : atual))}
              onDrop={(e) => {
                e.preventDefault()
                setSobreColuna(null)
                const numero = e.dataTransfer.getData('text/plain')
                if (numero) moverPara(numero, etapa.id)
              }}
              className={`flex flex-col w-72 shrink-0 rounded-xl border bg-ink-50/50 transition-colors ${
                sobreColuna === etapa.id ? 'border-brand-400 bg-brand-50/50' : 'border-ink-200'
              }`}
            >
              <div className="flex items-center gap-2 px-3 py-3 border-b border-ink-200">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: etapa.cor }} />
                <p className="text-sm font-semibold text-ink-900 truncate">{etapa.nome}</p>
                <span className="ml-auto text-xs text-ink-400 font-medium">{itens.length}</span>
              </div>

              <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[4rem]">
                {itens.length === 0 && <p className="text-xs text-ink-400 text-center py-6">Nenhuma conversa aqui.</p>}
                {itens.map((c) => (
                  <Link
                    key={c.numero}
                    href={`/dashboard/conversas?from=${encodeURIComponent(c.numero)}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', c.numero)
                      setArrastando(c.numero)
                    }}
                    onDragEnd={() => setArrastando(null)}
                    className={`block bg-white border border-ink-200 rounded-lg p-3 shadow-sm hover:shadow-md hover:border-brand-300 transition-all cursor-grab active:cursor-grabbing ${
                      arrastando === c.numero ? 'opacity-40' : ''
                    }`}
                  >
                    <p className="text-sm font-medium text-ink-900">{formatarNumero(c.numero)}</p>
                    <div className="flex flex-wrap items-center gap-1 mt-2">
                      {c.prioridade && c.prioridade !== 'normal' && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            c.prioridade === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {c.prioridade === 'urgente' ? 'Urgente' : 'Alta prioridade'}
                        </span>
                      )}
                      {c.protocolo && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-ink-100 text-ink-600">#{c.protocolo}</span>}
                      {c.etiquetas?.map((tag) => (
                        <span key={tag} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">
                          <Tag className="w-2.5 h-2.5" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <GerenciarEtapasModal
        open={gerenciarAberto}
        onClose={() => setGerenciarAberto(false)}
        etapasIniciais={etapas}
        onSalvo={(novas) => {
          setEtapas(novas)
          setGerenciarAberto(false)
        }}
      />
    </div>
  )
}

function GerenciarEtapasModal({
  open,
  onClose,
  etapasIniciais,
  onSalvo,
}: {
  open: boolean
  onClose: () => void
  etapasIniciais: FunilEtapa[]
  onSalvo: (etapas: FunilEtapa[]) => void
}) {
  const [etapas, setEtapas] = useState<FunilEtapa[]>(etapasIniciais)
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    if (open) setEtapas(etapasIniciais)
  }, [open, etapasIniciais])

  function atualizar(id: string, patch: Partial<FunilEtapa>) {
    setEtapas((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  }

  function adicionar() {
    const id = `etapa_${Date.now().toString(36)}`
    const cor = CORES_SUGERIDAS[etapas.length % CORES_SUGERIDAS.length]
    setEtapas((prev) => [...prev, { id, nome: 'Nova etapa', cor }])
  }

  function remover(id: string) {
    setEtapas((prev) => prev.filter((e) => e.id !== id))
  }

  function mover(index: number, direcao: -1 | 1) {
    setEtapas((prev) => {
      const alvo = index + direcao
      if (alvo < 0 || alvo >= prev.length) return prev
      const copia = [...prev]
      ;[copia[index], copia[alvo]] = [copia[alvo], copia[index]]
      return copia
    })
  }

  async function salvar() {
    if (etapas.length === 0) {
      toast.error('O funil precisa de pelo menos uma etapa')
      return
    }
    if (etapas.some((e) => !e.nome.trim())) {
      toast.error('Toda etapa precisa de um nome')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/conta/funil-etapas', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ etapas }),
      })
      if (!res.ok) throw new Error()
      const data: { etapas: FunilEtapa[] } = await res.json()
      toast.success('Etapas do funil atualizadas.')
      onSalvo(data.etapas)
    } catch {
      toast.error('Erro ao salvar — tente de novo')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Etapas do funil" widthClass="max-w-md">
      <div className="space-y-2">
        {etapas.map((etapa, i) => (
          <div key={etapa.id} className="flex items-center gap-2">
            <input
              type="color"
              value={etapa.cor}
              onChange={(e) => atualizar(etapa.id, { cor: e.target.value })}
              className="w-8 h-8 rounded border border-ink-200 shrink-0 cursor-pointer"
            />
            <input
              value={etapa.nome}
              onChange={(e) => atualizar(etapa.id, { nome: e.target.value })}
              className="flex-1 min-w-0 px-2.5 py-1.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button onClick={() => mover(i, -1)} disabled={i === 0} className="p-1.5 text-ink-400 hover:text-ink-700 disabled:opacity-30 disabled:hover:text-ink-400">
              ↑
            </button>
            <button onClick={() => mover(i, 1)} disabled={i === etapas.length - 1} className="p-1.5 text-ink-400 hover:text-ink-700 disabled:opacity-30 disabled:hover:text-ink-400">
              ↓
            </button>
            <button onClick={() => remover(etapa.id)} className="p-1.5 text-ink-400 hover:text-red-600">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          onClick={adicionar}
          className="flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 px-2.5 py-1.5"
        >
          <Plus className="w-4 h-4" />
          Adicionar etapa
        </button>
      </div>

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-ink-100">
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 rounded-lg">
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvar
        </button>
      </div>
    </Modal>
  )
}
