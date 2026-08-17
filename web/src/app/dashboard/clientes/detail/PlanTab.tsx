'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export default function PlanTab({ company, disabled, onUpdated }: TabProps) {
  const [name, setName] = useState(company.plan.name)
  const [expiresAt, setExpiresAt] = useState(toDateInputValue(company.plan.expires_at))
  const [messagesLimit, setMessagesLimit] = useState(company.plan.messages_limit?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/plan`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          messages_limit: messagesLimit ? Number(messagesLimit) : null,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar plano')
      onUpdated(data)
      toast.success('Plano atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar plano')
    } finally {
      setSaving(false)
    }
  }

  const usage = company.usage

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 bg-ink-50 rounded-lg p-3">
        <div>
          <p className="text-xs text-ink-500">Mensagens usadas no mês</p>
          <p className="text-sm font-medium text-ink-900">{usage.messages_this_month}</p>
        </div>
        <div>
          <p className="text-xs text-ink-500">Tokens usados no mês</p>
          <p className="text-sm font-medium text-ink-900">{usage.tokens_this_month}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-4">
        <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Plano</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Expira em</label>
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Limite de mensagens</label>
            <input
              type="number"
              min={0}
              value={messagesLimit}
              onChange={(e) => setMessagesLimit(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={disabled || saving}
          className="px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Salvando...' : 'Salvar plano'}
        </button>
      </form>
    </div>
  )
}
