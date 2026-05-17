'use client'

import { useEffect, useState } from 'react'
import { Plus, FileText, RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

type Category = 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
type SaveStatus = 'idle' | 'loading' | 'success' | 'error'

interface MetaTemplate {
  id: string
  name: string
  status: string
  category: string
  language: string
}

const categoryOptions: { value: Category; label: string }[] = [
  { value: 'UTILITY', label: 'Utilidade' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'AUTHENTICATION', label: 'Autenticação' },
]

const statusColors: Record<string, string> = {
  APPROVED: 'bg-green-50 text-green-700',
  PENDING: 'bg-yellow-50 text-yellow-700',
  REJECTED: 'bg-red-50 text-red-700',
  PAUSED: 'bg-gray-100 text-gray-500',
  DISABLED: 'bg-gray-100 text-gray-500',
}

const statusLabels: Record<string, string> = {
  APPROVED: 'Aprovado',
  PENDING: 'Pendente',
  REJECTED: 'Rejeitado',
  PAUSED: 'Pausado',
  DISABLED: 'Desabilitado',
}

export default function TemplatesPage() {
  const [name, setName] = useState('')
  const [category, setCategory] = useState<Category>('UTILITY')
  const [language, setLanguage] = useState('pt_BR')
  const [header, setHeader] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [footer, setFooter] = useState('')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [feedback, setFeedback] = useState('')

  const [templates, setTemplates] = useState<MetaTemplate[]>([])
  const [loadingList, setLoadingList] = useState(false)
  const [listError, setListError] = useState('')

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

  useEffect(() => { fetchTemplates() }, [])

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
      setSaveStatus('success')
      setFeedback(`Template "${json.name}" criado! Status: ${json.status ?? 'PENDING'}`)
      setName('')
      setHeader('')
      setBodyText('')
      setFooter('')
      fetchTemplates()
    } catch (err) {
      setSaveStatus('error')
      setFeedback(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Templates de Mensagem</h2>
          <p className="text-sm text-gray-500">Crie e gerencie modelos aprovados pelo Meta</p>
        </div>
        <button
          onClick={fetchTemplates}
          disabled={loadingList}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          Atualizar lista
        </button>
      </div>

      {/* Create form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-green-600" />
          Criar Novo Template
        </h3>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
          O nome será convertido automaticamente para <code>snake_case</code>. Após criado, o Meta leva até 24h para aprovar.
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nome do template *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Ex: boas_vindas"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Categoria *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                {categoryOptions.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Idioma *</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="pt_BR">Português (BR)</option>
                <option value="en_US">English (US)</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cabeçalho (opcional)</label>
            <input
              type="text"
              value={header}
              onChange={(e) => setHeader(e.target.value)}
              placeholder="Ex: Bem-vindo!"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Corpo da mensagem * <span className="text-gray-400">(use {'{{1}}'} para variáveis)</span>
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              required
              rows={4}
              placeholder={"Olá, {{1}}! Seja bem-vindo(a) à nossa plataforma. Em caso de dúvidas, entre em contato."}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Rodapé (opcional)</label>
            <input
              type="text"
              value={footer}
              onChange={(e) => setFooter(e.target.value)}
              placeholder="Ex: Não responda a este número."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {feedback && (
            <div className={`flex items-start gap-2 text-sm p-3 rounded-lg ${saveStatus === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {saveStatus === 'success'
                ? <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              }
              {feedback}
            </div>
          )}

          <button
            type="submit"
            disabled={saveStatus === 'loading' || !name || !bodyText}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {saveStatus === 'loading'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <FileText className="w-4 h-4" />
            }
            {saveStatus === 'loading' ? 'Enviando ao Meta...' : 'Criar Template'}
          </button>
        </form>
      </div>

      {/* Template list */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-800 text-sm">Templates no Meta</h3>

        {listError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {listError}
          </div>
        )}

        {loadingList && (
          <div className="flex items-center gap-2 py-8 justify-center text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Carregando templates...
          </div>
        )}

        {!loadingList && templates.length === 0 && !listError && (
          <div className="py-12 text-center text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
            Nenhum template encontrado. Crie o primeiro acima.
          </div>
        )}

        {templates.map((t) => (
          <div key={t.id} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-gray-900 font-mono">{t.name}</p>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{t.category}</span>
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">{t.language}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[t.status] ?? 'bg-gray-100 text-gray-500'}`}>
                {statusLabels[t.status] ?? t.status}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">ID: {t.id}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
