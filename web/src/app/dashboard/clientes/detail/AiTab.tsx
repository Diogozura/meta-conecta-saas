'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

export default function AiTab({ company, disabled, onUpdated }: TabProps) {
  const [enabled, setEnabled] = useState(company.ai.enabled)
  const [model, setModel] = useState(company.ai.model ?? '')
  const [assistantId, setAssistantId] = useState(company.ai.assistant_id ?? '')
  const [prompt, setPrompt] = useState(company.ai.prompt ?? '')
  const [temperature, setTemperature] = useState(company.ai.temperature)
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/ai`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          model: model || null,
          assistant_id: assistantId || null,
          prompt: prompt || null,
          temperature,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar configuração de IA')
      onUpdated(data)
      toast.success('Configuração de IA atualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configuração de IA')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          IA ativa
        </label>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Ex: gpt-5.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assistant ID</label>
          <input
            type="text"
            value={assistantId}
            onChange={(e) => setAssistantId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Prompt do agente</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Temperature ({temperature.toFixed(1)})</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </fieldset>

      <button
        type="submit"
        disabled={disabled || saving}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Salvando...' : 'Editar configurações da IA'}
      </button>
    </form>
  )
}
