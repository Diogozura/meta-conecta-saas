'use client'

import { useState } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CompanyCreateInput, CompanyCreateResponse, WhatsAppNumberInput } from '@/types/company'

interface AddCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (companyName: string, inviteLink: string) => void
}

const emptyWhatsApp: WhatsAppNumberInput = { number: '', label: '', active: true }

export default function AddCompanyModal({ isOpen, onClose, onCreated }: AddCompanyModalProps) {
  const [loading, setLoading] = useState(false)
  const [companyName, setCompanyName] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientEmail, setClientEmail] = useState('')
  const [sector, setSector] = useState('')
  const [whatsapp, setWhatsapp] = useState<WhatsAppNumberInput[]>([{ ...emptyWhatsApp }])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [planName, setPlanName] = useState('')
  const [planExpiresAt, setPlanExpiresAt] = useState('')
  const [planMessagesLimit, setPlanMessagesLimit] = useState('')

  if (!isOpen) return null

  const resetForm = () => {
    setCompanyName('')
    setCnpj('')
    setClientName('')
    setClientEmail('')
    setSector('')
    setWhatsapp([{ ...emptyWhatsApp }])
    setTags([])
    setTagInput('')
    setPlanName('')
    setPlanExpiresAt('')
    setPlanMessagesLimit('')
  }

  const updateWhatsappRow = (index: number, changes: Partial<WhatsAppNumberInput>) => {
    setWhatsapp((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)))
  }

  const addWhatsappRow = () => setWhatsapp((rows) => [...rows, { ...emptyWhatsApp }])

  const removeWhatsappRow = (index: number) => {
    setWhatsapp((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows))
  }

  const addTag = () => {
    const value = tagInput.trim()
    if (value && !tags.includes(value)) {
      setTags((t) => [...t, value])
    }
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags((t) => t.filter((x) => x !== tag))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const payload: CompanyCreateInput = {
        company_name: companyName,
        cnpj,
        client: { name: clientName, email: clientEmail },
        sector,
        whatsapp,
        tags,
        plan: {
          name: planName,
          expires_at: planExpiresAt ? new Date(planExpiresAt).toISOString() : null,
          messages_limit: planMessagesLimit ? Number(planMessagesLimit) : null,
        },
      }

      const response = await fetch('/api/empresas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data: CompanyCreateResponse & { error?: string } = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar empresa')
      }

      resetForm()
      onCreated(data.company.company_name, data.admin_invite_link)
    } catch (error) {
      console.error('Erro ao criar empresa:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar empresa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Nova Empresa</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Geral */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome da empresa <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Ex: Empresa ABC"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                CNPJ <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="12.345.678/0001-99"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Responsável <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                E-mail do responsável <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="joao@empresa.com"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Setor <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                placeholder="Ex: Clínica"
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Números de WhatsApp <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={addWhatsappRow}
                className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:text-green-800"
              >
                <Plus className="w-3.5 h-3.5" />
                Adicionar número
              </button>
            </div>
            <div className="space-y-2">
              {whatsapp.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={row.number}
                    onChange={(e) => updateWhatsappRow(index, { number: e.target.value })}
                    placeholder="+5511999999999"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <input
                    type="text"
                    required
                    value={row.label}
                    onChange={(e) => updateWhatsappRow(index, { label: e.target.value })}
                    placeholder="Rótulo (ex: Principal)"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                  />
                  <button
                    type="button"
                    onClick={() => removeWhatsappRow(index)}
                    disabled={whatsapp.length === 1}
                    className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-gray-100 text-gray-700"
                >
                  {tag}
                  <button type="button" onClick={() => removeTag(tag)}>
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTag()
                }
              }}
              placeholder="Digite uma tag e pressione Enter"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Plano */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Plano <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
                placeholder="Ex: Pro"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Expira em</label>
              <input
                type="date"
                value={planExpiresAt}
                onChange={(e) => setPlanExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Limite de mensagens</label>
              <input
                type="number"
                min={0}
                value={planMessagesLimit}
                onChange={(e) => setPlanMessagesLimit(e.target.value)}
                placeholder="Ex: 50000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 -mt-2">
            As configurações de IA (mensagens, imagem, áudio) ficam disponíveis na aba &quot;IA&quot; depois de criar a empresa.
          </p>

          {/* Ações */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Criando...' : 'Criar empresa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
