'use client'

import { useCallback, useEffect, useState } from 'react'
import { Building2, Search, Phone, Mail, MoreHorizontal, Copy, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import AddCompanyModal from './AddCompanyModal'
import CompanyDetailPanel from './detail/CompanyDetailPanel'
import { Skeleton } from '@/components/Skeleton'
import type { CompanyListItem, CompanyStatus, MetaConnectionStatus } from '@/types/company'

const statusBadge: Record<CompanyStatus, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-brand-50 text-brand-700' },
  inactive: { label: 'Inativa', className: 'bg-red-50 text-red-700' },
  deleted: { label: 'Excluída', className: 'bg-ink-100 text-ink-500' },
}

const metaBadge: Record<MetaConnectionStatus, { label: string; className: string }> = {
  connected: { label: 'Meta Conectada', className: 'bg-brand-50 text-brand-700' },
  inactive: { label: 'Meta Desconectada', className: 'bg-red-50 text-red-700' },
}

function aiBadge(enabled: boolean) {
  return enabled
    ? { label: 'IA Ativa', className: 'bg-purple-50 text-purple-700' }
    : { label: 'IA Desativada', className: 'bg-ink-100 text-ink-500' }
}

const searchByLabels: Record<string, string> = {
  name: 'Nome',
  email: 'E-mail',
  cnpj: 'CNPJ',
  tag: 'Tag',
}

export default function EmpresasPageClient() {
  const [items, setItems] = useState<CompanyListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [cursorStack, setCursorStack] = useState<string[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)

  const [searchValue, setSearchValue] = useState('')
  const [searchBy, setSearchBy] = useState<'name' | 'email' | 'cnpj' | 'tag'>('name')
  const [statusFilter, setStatusFilter] = useState<CompanyStatus | ''>('')
  const [metaFilter, setMetaFilter] = useState<MetaConnectionStatus | ''>('')
  const [aiFilter, setAiFilter] = useState<'' | 'true' | 'false'>('')
  const [planFilter, setPlanFilter] = useState('')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null)
  const [inviteInfo, setInviteInfo] = useState<{ companyName: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [pendingCompanyId, setPendingCompanyId] = useState<string | null>(null)

  const loadCompanies = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '20')
      if (cursor) params.set('cursor', cursor)
      if (searchValue.trim()) {
        params.set('q', searchValue.trim())
        params.set('search_by', searchBy)
      }
      if (statusFilter) params.set('status', statusFilter)
      if (metaFilter) params.set('meta_status', metaFilter)
      if (aiFilter) params.set('ai_enabled', aiFilter)
      if (planFilter.trim()) params.set('plan_name', planFilter.trim())

      const response = await fetch(`/api/empresas?${params.toString()}`)
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao carregar empresas')
      }
      setItems(data.items || [])
      setNextCursor(data.next_cursor ?? null)
    } catch (error) {
      console.error('Erro ao carregar empresas:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar empresas')
    } finally {
      setLoading(false)
    }
  }, [cursor, searchValue, searchBy, statusFilter, metaFilter, aiFilter, planFilter])

  // Debounce: recarrega a lista quando busca/filtros/cursor mudam.
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadCompanies()
    }, 400)
    return () => clearTimeout(timeout)
  }, [loadCompanies])

  // Qualquer mudança de busca/filtro volta pra primeira página.
  const resetPagination = () => {
    setCursor(undefined)
    setCursorStack([])
  }

  const goToNextPage = () => {
    if (!nextCursor) return
    setCursorStack((stack) => [...stack, cursor ?? ''])
    setCursor(nextCursor)
  }

  const goToPreviousPage = () => {
    setCursorStack((stack) => {
      const copy = [...stack]
      const previous = copy.pop()
      setCursor(previous || undefined)
      return copy
    })
  }

  const handleCreated = (companyName: string, inviteLink: string) => {
    setIsCreateOpen(false)
    setInviteInfo({ companyName, link: inviteLink })
    setCopied(false)
    resetPagination()
    loadCompanies()
  }

  const handleCopyInvite = async () => {
    if (!inviteInfo) return
    await navigator.clipboard.writeText(inviteInfo.link)
    setCopied(true)
  }

  const formatDate = (date: string) => {
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const quickAction = async (id: string, action: 'activate' | 'deactivate' | 'delete', label: string) => {
    if (pendingCompanyId) return // já tem uma ação em andamento — evita disparo duplicado
    setPendingCompanyId(id)
    try {
      const method = action === 'delete' ? 'DELETE' : 'PATCH'
      const path = action === 'delete' ? `/api/empresas/${id}` : `/api/empresas/${id}/${action}`
      const response = await fetch(path, { method })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Erro ao ${label}`)
      toast.success(`Empresa ${label} com sucesso.`)
      loadCompanies()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Erro ao ${label}`)
    } finally {
      setPendingCompanyId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Empresas</h2>
          <p className="text-sm text-ink-500">Gerencie as contas de clientes do SaaS</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Building2 className="w-4 h-4" />
          Nova Empresa
        </button>
      </div>

      {/* Banner de convite pós-criação */}
      {inviteInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Empresa {inviteInfo.companyName} criada.</p>
            <p className="text-blue-800 mt-0.5 break-all">Link de convite do responsável: {inviteInfo.link}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={() => setInviteInfo(null)}
              className="p-1.5 rounded-md text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Busca + filtros */}
      <div className="bg-white rounded-xl border border-ink-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
            <input
              type="text"
              placeholder={`Buscar por ${searchByLabels[searchBy].toLowerCase()}...`}
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value)
                resetPagination()
              }}
              className="w-full pl-9 pr-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <select
            value={searchBy}
            onChange={(e) => {
              setSearchBy(e.target.value as typeof searchBy)
              resetPagination()
            }}
            className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {Object.entries(searchByLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as CompanyStatus | '')
              resetPagination()
            }}
            className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Todos os status</option>
            <option value="active">Ativa</option>
            <option value="inactive">Inativa</option>
            <option value="deleted">Excluída</option>
          </select>

          <select
            value={metaFilter}
            onChange={(e) => {
              setMetaFilter(e.target.value as MetaConnectionStatus | '')
              resetPagination()
            }}
            className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">Meta: todas</option>
            <option value="connected">Meta conectada</option>
            <option value="inactive">Meta desconectada</option>
          </select>

          <select
            value={aiFilter}
            onChange={(e) => {
              setAiFilter(e.target.value as typeof aiFilter)
              resetPagination()
            }}
            className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            <option value="">IA: todas</option>
            <option value="true">IA ativa</option>
            <option value="false">IA desativada</option>
          </select>

          <input
            type="text"
            placeholder="Filtrar por plano..."
            value={planFilter}
            onChange={(e) => {
              setPlanFilter(e.target.value)
              resetPagination()
            }}
            className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* Tabela */}
      <div data-tour="clientes-list" className="bg-white rounded-xl border border-ink-200 overflow-x-auto">
        {!loading && items.length === 0 ? (
          <div className="p-8 text-center text-ink-500">Nenhuma empresa encontrada</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Empresa</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Responsável</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Setor</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Plano</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">WhatsApp</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Cadastro</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && Array.from({ length: 6 }).map((_, i) => <CompanyRowSkeleton key={i} />)}
              {!loading && items.map((company) => {
                const status = statusBadge[company.status]
                const meta = metaBadge[company.meta_connection_status]
                const ai = aiBadge(company.ai_enabled)
                return (
                  <tr
                    key={company.id}
                    className="hover:bg-ink-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedCompanyId(company.id)}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand-700">{company.company_name[0]}</span>
                        </div>
                        <span className="font-medium text-ink-900">{company.company_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-ink-700">{company.client_name}</span>
                        <span className="flex items-center gap-1.5 text-ink-500">
                          <Mail className="w-3 h-3 text-ink-400" />
                          {company.client_email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{company.sector}</td>
                    <td className="px-5 py-3 text-ink-600">{company.plan_name}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-ink-600">
                        <Phone className="w-3 h-3 text-ink-400" />
                        {company.whatsapp_count}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.className}`}>{status.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ai.className}`}>{ai.label}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-500">{formatDate(company.created_at)}</td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <QuickActionsMenu
                        company={company}
                        onAction={quickAction}
                        isPending={pendingCompanyId === company.id}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginação */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={goToPreviousPage}
          disabled={cursorStack.length === 0}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-ink-300 rounded-lg text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Anterior
        </button>
        <button
          onClick={goToNextPage}
          disabled={!nextCursor}
          className="inline-flex items-center gap-1 px-3 py-1.5 border border-ink-300 rounded-lg text-sm text-ink-600 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Próxima
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Modal de criação */}
      <AddCompanyModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={handleCreated} />

      {/* Painel de detalhes */}
      {selectedCompanyId && (
        <CompanyDetailPanel
          key={selectedCompanyId}
          companyId={selectedCompanyId}
          onClose={() => setSelectedCompanyId(null)}
          onChanged={loadCompanies}
        />
      )}
    </div>
  )
}

function CompanyRowSkeleton() {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <Skeleton className="h-4 w-32" />
        </div>
      </td>
      <td className="px-5 py-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3.5 w-32" />
        </div>
      </td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-16" /></td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-8" /></td>
      <td className="px-5 py-3">
        <div className="flex gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-5 py-3" />
    </tr>
  )
}

function QuickActionsMenu({
  company,
  onAction,
  isPending,
}: {
  company: CompanyListItem
  onAction: (id: string, action: 'activate' | 'deactivate' | 'delete', label: string) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const closeMenu = () => {
    setOpen(false)
    setConfirmingDelete(false)
  }

  return (
    <div className="relative inline-block text-left">
      <button
        disabled={isPending}
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 hover:bg-ink-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={closeMenu} />
          <div className="absolute right-0 z-20 mt-1 w-56 bg-white border border-ink-200 rounded-lg shadow-lg py-1">
            {confirmingDelete ? (
              <div className="px-3 py-2 space-y-2">
                <p className="text-xs text-ink-600">Confirmar exclusão de {company.company_name}?</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      closeMenu()
                      onAction(company.id, 'delete', 'excluída')
                    }}
                    className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmingDelete(false)}
                    className="px-3 py-1.5 text-xs font-medium border border-ink-300 rounded-lg text-ink-700 hover:bg-ink-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                {company.status !== 'active' && (
                  <button
                    onClick={() => {
                      closeMenu()
                      onAction(company.id, 'activate', 'ativada')
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                  >
                    Ativar
                  </button>
                )}
                {company.status === 'active' && (
                  <button
                    onClick={() => {
                      closeMenu()
                      onAction(company.id, 'deactivate', 'desativada')
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
                  >
                    Desativar
                  </button>
                )}
                {company.status !== 'deleted' && (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
