'use client'

import { useState } from 'react'
import { X, Info } from 'lucide-react'
import type { AccessLevel, UserCreateInput } from '@/types/user'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (user: UserCreateInput) => Promise<void>
}

const accessLevelInfo: Record<AccessLevel, { label: string; description: string }> = {
  administrador: { label: 'Administrador', description: 'Controle total: usuários, integrações, configurações da empresa.' },
  supervisor: { label: 'Supervisor', description: 'Gerencia usuários, templates, números e webhooks.' },
  atendente: { label: 'Atendente', description: 'Envia mensagens, gerencia conversas, visualiza clientes.' },
}

export default function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('atendente')
  const [sector, setSector] = useState('')

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onAdd({
        name,
        email,
        role,
        access_level: accessLevel,
        sector: sector || null,
      })
      setName('')
      setEmail('')
      setRole('')
      setAccessLevel('atendente')
      setSector('')
      onClose()
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error)
      alert(error instanceof Error ? error.message : 'Erro ao adicionar usuário. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h3 className="text-lg font-bold text-ink-900">Adicionar Usuário</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Nome completo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Ex: joao@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Cargo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Ex: Atendente de Vendas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Setor
            </label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              placeholder="Ex: Vendas"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">
              Nível de Acesso <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={accessLevel}
              onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <option value="administrador">Administrador</option>
              <option value="supervisor">Supervisor</option>
              <option value="atendente">Atendente</option>
            </select>

            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  <strong>{accessLevelInfo[accessLevel].label}:</strong> {accessLevelInfo[accessLevel].description}
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-ink-50 rounded-lg">
            <Info className="w-4 h-4 text-ink-500 mt-0.5 shrink-0" />
            <p className="text-xs text-ink-600">
              Ao adicionar, um link de convite é gerado para a pessoa definir a própria senha.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-ink-300 text-ink-700 text-sm font-medium rounded-lg hover:bg-ink-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adicionando...' : 'Adicionar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
