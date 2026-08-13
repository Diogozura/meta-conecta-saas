'use client'

import { useState } from 'react'
import { Pencil, Trash2, Plus, Check, X, MessageSquare, Image as ImageIcon, Mic, Sparkles, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import type {
  AIProviderConfig,
  AIProviderConfigInput,
  AIProviderConfigUpdateInput,
  AIProvider,
  AIPurpose,
  CompanyResponse,
} from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

const providerLabels: Record<AIProvider, string> = {
  openai: 'OpenAI (ChatGPT)',
  anthropic: 'Anthropic (Claude)',
  gemini: 'Google (Gemini)',
}

const purposeLabels: Record<AIPurpose, string> = {
  mensagem: 'Mensagens de texto',
  imagem: 'Geração de imagem',
  audio: 'Áudio / transcrição',
  outro: 'Outro',
}

const purposeIcons: Record<AIPurpose, React.ComponentType<{ className?: string }>> = {
  mensagem: MessageSquare,
  imagem: ImageIcon,
  audio: Mic,
  outro: Sparkles,
}

type FormState = {
  label: string
  purpose: AIPurpose
  provider: AIProvider
  model: string
  apiKey: string
  assistantId: string
  prompt: string
  temperature: number
  enabled: boolean
}

const emptyForm: FormState = {
  label: '',
  purpose: 'mensagem',
  provider: 'openai',
  model: '',
  apiKey: '',
  assistantId: '',
  prompt: '',
  temperature: 0.7,
  enabled: true,
}

export default function AiTab({ company, disabled, onUpdated }: TabProps) {
  const [addingOpen, setAddingOpen] = useState(false)
  const [addForm, setAddForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<FormState>(emptyForm)
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const startEdit = (item: AIProviderConfig) => {
    setEditingId(item.id)
    setEditForm({
      label: item.label,
      purpose: item.purpose,
      provider: item.provider,
      model: item.model,
      apiKey: '',
      assistantId: item.assistant_id ?? '',
      prompt: item.prompt ?? '',
      temperature: item.temperature,
      enabled: item.enabled,
    })
  }

  const cancelEdit = () => setEditingId(null)

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload: AIProviderConfigInput = {
        label: addForm.label,
        purpose: addForm.purpose,
        provider: addForm.provider,
        model: addForm.model,
        api_key: addForm.apiKey,
        assistant_id: addForm.assistantId || null,
        prompt: addForm.prompt || null,
        temperature: addForm.temperature,
        enabled: addForm.enabled,
      }
      const response = await fetch(`/api/empresas/${company.id}/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao adicionar configuração de IA')
      onUpdated(data)
      setAddForm(emptyForm)
      setAddingOpen(false)
      toast.success('Configuração de IA adicionada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar configuração de IA')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (id: string) => {
    setBusy(true)
    try {
      const payload: AIProviderConfigUpdateInput = {
        label: editForm.label,
        purpose: editForm.purpose,
        provider: editForm.provider,
        model: editForm.model,
        assistant_id: editForm.assistantId || null,
        prompt: editForm.prompt || null,
        temperature: editForm.temperature,
        enabled: editForm.enabled,
      }
      if (editForm.apiKey) payload.api_key = editForm.apiKey
      const response = await fetch(`/api/empresas/${company.id}/ai/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar configuração de IA')
      onUpdated(data)
      setEditingId(null)
      toast.success('Configuração de IA atualizada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configuração de IA')
    } finally {
      setBusy(false)
    }
  }

  const removeConfig = async (id: string) => {
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/ai/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao remover configuração de IA')
      onUpdated(data)
      setConfirmingRemoveId(null)
      toast.success('Configuração de IA removida.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover configuração de IA')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      {company.ai.length === 0 && !addingOpen && (
        <div className="text-center py-6 px-4 border border-dashed border-gray-300 rounded-lg">
          <p className="text-sm text-gray-600">Nenhuma IA configurada ainda.</p>
          <p className="text-xs text-gray-400 mt-1">
            Adicione uma API para responder mensagens, gerar imagens ou transcrever áudio automaticamente.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {company.ai.map((item) => {
          const Icon = purposeIcons[item.purpose]
          return (
            <div key={item.id} className="border border-gray-200 rounded-lg p-3">
              {editingId === item.id ? (
                <div className="space-y-3">
                  <AiConfigFields
                    value={editForm}
                    onChange={setEditForm}
                    apiKeyPlaceholder={item.has_api_key ? 'Chave salva — deixe em branco para manter' : 'sk-...'}
                  />
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => saveEdit(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Salvar
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : confirmingRemoveId === item.id ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-gray-600">Remover &quot;{item.label}&quot;?</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      disabled={busy}
                      onClick={() => removeConfig(item.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirmingRemoveId(null)}
                      className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-purple-50 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {purposeLabels[item.purpose]} · {providerLabels[item.provider]} · {item.model}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        item.enabled ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.enabled ? 'Ativa' : 'Inativa'}
                    </span>
                    {!disabled && (
                      <>
                        <button
                          onClick={() => startEdit(item)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConfirmingRemoveId(item.id)}
                          className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {!disabled &&
        (addingOpen ? (
          <form onSubmit={handleAdd} className="border-t border-gray-200 pt-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Nova configuração de IA</p>
            <AiConfigFields value={addForm} onChange={setAddForm} apiKeyPlaceholder="sk-..." apiKeyRequired />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {saving ? 'Adicionando...' : 'Adicionar'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingOpen(false)
                  setAddForm(emptyForm)
                }}
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setAddingOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Adicionar API de IA
          </button>
        ))}
    </div>
  )
}

function AiConfigFields({
  value,
  onChange,
  apiKeyPlaceholder,
  apiKeyRequired,
}: {
  value: FormState
  onChange: (value: FormState) => void
  apiKeyPlaceholder: string
  apiKeyRequired?: boolean
}) {
  const set = (changes: Partial<FormState>) => onChange({ ...value, ...changes })

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Nome (para você identificar)</label>
        <input
          type="text"
          required
          value={value.label}
          onChange={(e) => set({ label: e.target.value })}
          placeholder="Ex: Atendimento por texto"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Finalidade</label>
          <select
            value={value.purpose}
            onChange={(e) => set({ purpose: e.target.value as AIPurpose })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {Object.entries(purposeLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Provedor</label>
          <select
            value={value.provider}
            onChange={(e) => set({ provider: e.target.value as AIProvider })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          >
            {Object.entries(providerLabels).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Modelo</label>
        <input
          type="text"
          required
          value={value.model}
          onChange={(e) => set({ model: e.target.value })}
          placeholder="Ex: gpt-5.5"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
      </div>
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1">
          <KeyRound className="w-3.5 h-3.5" />
          Chave da API (API key)
        </label>
        <input
          type="password"
          required={apiKeyRequired}
          value={value.apiKey}
          onChange={(e) => set({ apiKey: e.target.value })}
          placeholder={apiKeyPlaceholder}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
        />
        <p className="text-[11px] text-gray-400 mt-1">Guardada de forma criptografada. Nunca é exibida novamente.</p>
      </div>
      {value.provider === 'openai' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assistant ID (opcional)</label>
          <input
            type="text"
            value={value.assistantId}
            onChange={(e) => set({ assistantId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Prompt do agente</label>
        <textarea
          value={value.prompt}
          onChange={(e) => set({ prompt: e.target.value })}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Temperature ({value.temperature.toFixed(1)})</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.1}
          value={value.temperature}
          onChange={(e) => set({ temperature: Number(e.target.value) })}
          className="w-full"
        />
      </div>
      <label className="flex items-center gap-2 text-xs font-medium text-gray-600">
        <input type="checkbox" checked={value.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        Ativa
      </label>
    </div>
  )
}
