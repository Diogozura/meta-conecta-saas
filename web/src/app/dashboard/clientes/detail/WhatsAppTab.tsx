'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CompanyResponse, WhatsAppNumber } from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

export default function WhatsAppTab({ company, disabled, onUpdated }: TabProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNumber, setEditNumber] = useState('')
  const [editLabel, setEditLabel] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)

  const isLastNumber = company.whatsapp.length <= 1

  const [newNumber, setNewNumber] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)

  const startEdit = (item: WhatsAppNumber) => {
    setEditingId(item.id)
    setEditNumber(item.number)
    setEditLabel(item.label)
    setEditActive(item.active)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (whatsappId: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/whatsapp/${whatsappId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: editNumber, label: editLabel, active: editActive }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao editar número')
      onUpdated(data)
      setEditingId(null)
      toast.success('Número atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao editar número')
    } finally {
      setBusy(false)
    }
  }

  const removeNumber = async (whatsappId: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/whatsapp/${whatsappId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao remover número')
      onUpdated(data)
      setConfirmingRemoveId(null)
      toast.success('Número removido.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover número')
    } finally {
      setBusy(false)
    }
  }

  const addNumber = async (e: React.FormEvent) => {
    e.preventDefault()
    setAdding(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ number: newNumber, label: newLabel, active: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao adicionar número')
      onUpdated(data)
      setNewNumber('')
      setNewLabel('')
      toast.success('Número adicionado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar número')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {company.whatsapp.map((item) => (
          <div key={item.id} className="border border-ink-200 rounded-lg p-3">
            {editingId === item.id ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value)}
                  className="w-full px-3 py-1.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <input
                  type="text"
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="w-full px-3 py-1.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <label className="flex items-center gap-2 text-sm text-ink-600">
                  <input type="checkbox" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                  Ativo
                </label>
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={() => saveEdit(item.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-ink-300 text-xs font-medium rounded-lg text-ink-700 hover:bg-ink-50 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancelar
                  </button>
                </div>
              </div>
            ) : confirmingRemoveId === item.id ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-ink-600">Remover {item.number}?</p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    disabled={busy}
                    onClick={() => removeNumber(item.id)}
                    className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => setConfirmingRemoveId(null)}
                    className="px-3 py-1.5 text-xs font-medium border border-ink-300 rounded-lg text-ink-700 hover:bg-ink-50 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-900">{item.number}</p>
                  <p className="text-xs text-ink-500">
                    {item.label} · {item.active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => startEdit(item)}
                      className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      disabled={busy || isLastNumber}
                      title={isLastNumber ? 'A empresa deve manter ao menos um número de WhatsApp' : undefined}
                      onClick={() => setConfirmingRemoveId(item.id)}
                      className="p-1.5 rounded-md text-ink-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!disabled && (
        <form onSubmit={addNumber} className="border-t border-ink-200 pt-4 space-y-2">
          <p className="text-sm font-medium text-ink-700">Adicionar novo WhatsApp</p>
          <input
            type="text"
            required
            value={newNumber}
            onChange={(e) => setNewNumber(e.target.value)}
            placeholder="+5511999999999"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            type="text"
            required
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Rótulo (ex: Suporte)"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button
            type="submit"
            disabled={adding}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            {adding ? 'Adicionando...' : 'Adicionar'}
          </button>
        </form>
      )}
    </div>
  )
}
