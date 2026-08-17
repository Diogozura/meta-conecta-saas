'use client'

import { useState } from 'react'
import { X, FileText, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
type SaveStatus = 'idle' | 'loading' | 'success' | 'error'

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'UTILITY', label: 'Utilidade' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}

export default function CreateTemplateModal({ isOpen, onClose, onCreated }: CreateTemplateModalProps) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('UTILITY')
  const [language, setLanguage] = useState('pt_BR')
  const [header, setHeader] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footer, setFooter] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [feedback, setFeedback] = useState('')

  if (!isOpen) return null

  function resetForm() {
    setName('')
    setHeader('')
    setBodyText('')
    setFooter('')
    setSaveStatus('idle')
    setFeedback('')
  }

  function handleClose() {
    resetForm()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaveStatus('loading')
    setFeedback('')
    try {
      const res = await fetch('/api/meta/create-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, language, header, bodyText, footer }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Template "${json.name}" criado! Status: ${json.status ?? 'PENDING'}`)
      onCreated()
      resetForm()
      onClose()
    } catch (err) {
      setSaveStatus('error')
      setFeedback(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={handleClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h3 className="text-lg font-bold text-ink-900">Criar Novo Template</h3>
          <button onClick={handleClose} className="p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            O nome será convertido automaticamente para <code>snake_case</code>. Após criado, o Meta leva até 24h para aprovar.
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Nome do template <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: boas_vindas"
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-1.5">Idioma *</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="pt_BR">Português (BR)</option>
                <option value="en_US">English (US)</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Cabeçalho (opcional)</label>
            <input
              type="text"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Ex: Bem-vindo!"
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Corpo da mensagem * <span className="text-ink-400 font-normal">(use {'{{1}}'} para variáveis)</span>
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              required
              rows={4}
              placeholder={"Olá, {{1}}! Seja bem-vindo(a) à nossa plataforma. Em caso de dúvidas, entre em contato."}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Rodapé (opcional)</label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Ex: Não responda a este número."
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          {feedback && (
            <div className="flex items-start gap-2 text-sm p-3 rounded-lg bg-red-50 text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              {feedback}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 border border-ink-300 text-ink-700 text-sm font-medium rounded-lg hover:bg-ink-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saveStatus === 'loading' || !name || !bodyText}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saveStatus === 'loading'
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <FileText className="w-4 h-4" />
              }
              {saveStatus === 'loading' ? 'Enviando ao Meta...' : 'Criar Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
