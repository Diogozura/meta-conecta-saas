'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

export default function GeneralTab({ company, disabled, onUpdated }: TabProps) {
  const [companyName, setCompanyName] = useState(company.company_name)
  const [cnpj, setCnpj] = useState(company.cnpj)
  const [clientName, setClientName] = useState(company.client.name)
  const [clientEmail, setClientEmail] = useState(company.client.email)
  const [sector, setSector] = useState(company.sector)
  const [tags, setTags] = useState<string[]>(company.tags)
  const [tagInput, setTagInput] = useState('')
  const [saving, setSaving] = useState(false)

  const addTag = () => {
    const value = tagInput.trim()
    if (value && !tags.includes(value)) setTags((t) => [...t, value])
    setTagInput('')
  }

  const removeTag = (tag: string) => setTags((t) => t.filter((x) => x !== tag))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName,
          cnpj,
          client: { name: clientName, email: clientEmail },
          sector,
          tags,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao salvar')
      onUpdated(data)
      toast.success('Dados gerais atualizados.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome da empresa</label>
          <input
            type="text"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">CNPJ</label>
          <input
            type="text"
            required
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Responsável</label>
          <input
            type="text"
            required
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail do responsável</label>
          <input
            type="email"
            required
            value={clientEmail}
            onChange={(e) => setClientEmail(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Setor</label>
          <input
            type="text"
            required
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
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
      </fieldset>

      <button
        type="submit"
        disabled={disabled || saving}
        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Salvando...' : 'Salvar alterações'}
      </button>
    </form>
  )
}
