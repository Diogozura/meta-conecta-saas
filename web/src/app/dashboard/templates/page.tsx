'use client'

import { useEffect, useState } from 'react'
import { Plus, RefreshCw, AlertCircle } from 'lucide-react'
import CreateTemplateModal from './CreateTemplateModal'

interface MetaTemplate {
  id: string
  name: string
  status: string
  category: string
  language: string
}

const statusColors: Record<string, string> = {
  APPROVED: 'bg-brand-50 text-brand-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  REJECTED: 'bg-red-50 text-red-700',
  PAUSED: 'bg-ink-100 text-ink-500',
  DISABLED: 'bg-ink-100 text-ink-500',
}

const statusLabels: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Pendente',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desabilitado',
}

function TemplateCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-5 animate-pulse">
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-4 w-36 bg-ink-100 rounded" />
        <div className="h-4 w-16 bg-ink-100 rounded-full" />
        <div className="h-4 w-12 bg-ink-100 rounded-full" />
        <div className="h-4 w-20 bg-ink-100 rounded-full" />
      </div>
      <div className="h-3 w-44 bg-ink-100 rounded mt-2.5" />
    </div>
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [listError, setListError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  async function fetchTemplates() {
    setLoadingList(true)
    setListError('')
    try {
      const res = await fetch('/api/meta/list-templates')
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTemplates(json.templates ?? [])
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Erro ao carregar templates')
    } finally {
      setLoadingList(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    fetchTemplates()
  }, [])

  const isInitialLoading = loadingList && templates.length === 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Templates de Mensagem</h2>
          <p className="text-sm text-ink-500">Crie e gerencie modelos aprovados pelo Meta</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={fetchTemplates}
            disabled={loadingList}
            className="inline-flex items-center gap-2 px-4 py-2 border border-ink-300 text-sm font-medium rounded-lg text-ink-600 hover:bg-ink-50 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
            Atualizar lista
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Criar Novo Template
          </button>
        </div>
      </div>

      <CreateTemplateModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={fetchTemplates}
      />

      {/* Template list */}
      <div className="space-y-3">
        <h3 className="font-semibold text-ink-800 text-sm">Templates no Meta</h3>

        {listError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {listError}
          </div>
        )}

        {isInitialLoading && (
          <div className="space-y-3">
            <TemplateCardSkeleton />
            <TemplateCardSkeleton />
            <TemplateCardSkeleton />
          </div>
        )}

        {!isInitialLoading && templates.length === 0 && !listError && (
          <div className="py-12 text-center text-ink-400 text-sm bg-white rounded-xl border border-ink-200">
            Nenhum template encontrado. Crie o primeiro acima.
          </div>
        )}

        {!isInitialLoading && templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-ink-200 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink-900 font-mono">{t.name}</p>
              <span className="text-xs bg-ink-100 text-ink-500 px-2 py-0.5 rounded-full">{t.category}</span>
              <span className="text-xs bg-ink-100 text-ink-400 px-2 py-0.5 rounded-full">{t.language}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] ?? 'bg-ink-100 text-ink-500'}`}>
                {statusLabels[t.status] ?? t.status}
              </span>
            </div>
            <p className="text-xs text-ink-400 mt-1">ID: {t.id}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
