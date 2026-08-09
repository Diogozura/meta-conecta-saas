'use client'

import { useEffect, useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'
import GeneralTab from './GeneralTab'
import WhatsAppTab from './WhatsAppTab'
import MetaTab from './MetaTab'
import AiTab from './AiTab'
import PlanTab from './PlanTab'
import UsersTab from './UsersTab'

interface CompanyDetailPanelProps {
  companyId: string
  onClose: () => void
  onChanged: () => void
}

type TabKey = 'geral' | 'whatsapp' | 'meta' | 'ia' | 'plano' | 'usuarios'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'geral', label: 'Geral' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'meta', label: 'Meta' },
  { key: 'ia', label: 'IA' },
  { key: 'plano', label: 'Plano' },
  { key: 'usuarios', label: 'Usuários' },
]

const statusBadge: Record<CompanyResponse['status'], { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-green-50 text-green-700' },
  inactive: { label: 'Inativa', className: 'bg-red-50 text-red-700' },
  deleted: { label: 'Excluída', className: 'bg-gray-100 text-gray-500' },
}

export default function CompanyDetailPanel({ companyId, onClose, onChanged }: CompanyDetailPanelProps) {
  const [company, setCompany] = useState<CompanyResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabKey>('geral')
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/empresas/${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setCompany(data)
      })
      .catch((error) => {
        console.error('Erro ao carregar empresa:', error)
        toast.error('Erro ao carregar empresa')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId])

  const handleUpdated = (updated: CompanyResponse) => {
    setCompany(updated)
    onChanged()
  }

  const runAction = async (path: string, method: string, successLabel: string) => {
    setActionLoading(true)
    try {
      const response = await fetch(path, { method })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || `Erro ao ${successLabel}`)
      setCompany(data)
      onChanged()
      toast.success(`Empresa ${successLabel} com sucesso.`)
      setConfirmingDelete(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Erro ao ${successLabel}`)
    } finally {
      setActionLoading(false)
    }
  }

  const disabled = company?.status === 'deleted'

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white h-full shadow-xl flex flex-col overflow-hidden">
        {loading || !company ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-gray-200 p-5 space-y-3 shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{company.company_name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{company.cnpj}</p>
                </div>
                <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge[company.status].className}`}>
                {statusBadge[company.status].label}
              </span>

              {/* Ações */}
              <div className="flex flex-wrap gap-2 pt-1">
                {company.status === 'active' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => runAction(`/api/empresas/${company.id}/deactivate`, 'PATCH', 'desativada')}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Desativar
                  </button>
                )}
                {company.status === 'inactive' && (
                  <button
                    disabled={actionLoading}
                    onClick={() => runAction(`/api/empresas/${company.id}/activate`, 'PATCH', 'ativada')}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    Ativar
                  </button>
                )}
                {company.status === 'deleted' ? (
                  <button
                    disabled={actionLoading}
                    onClick={() => runAction(`/api/empresas/${company.id}/restore`, 'PATCH', 'restaurada')}
                    className="px-3 py-1.5 text-xs font-medium border border-green-300 text-green-700 rounded-lg hover:bg-green-50 disabled:opacity-50 transition-colors"
                  >
                    Restaurar
                  </button>
                ) : confirmingDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Confirmar exclusão?</span>
                    <button
                      disabled={actionLoading}
                      onClick={() => runAction(`/api/empresas/${company.id}`, 'DELETE', 'excluída')}
                      className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </div>

            {/* Tab nav */}
            <div className="flex border-b border-gray-200 shrink-0 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    activeTab === tab.key
                      ? 'border-green-600 text-green-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'geral' && <GeneralTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
              {activeTab === 'whatsapp' && <WhatsAppTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
              {activeTab === 'meta' && <MetaTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
              {activeTab === 'ia' && <AiTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
              {activeTab === 'plano' && <PlanTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
              {activeTab === 'usuarios' && <UsersTab company={company} disabled={disabled} onUpdated={handleUpdated} />}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
