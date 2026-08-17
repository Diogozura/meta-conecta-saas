'use client'

import { useState } from 'react'
import { X, Info } from 'lucide-react'
import type { AccessLevel, UserResponse, UserUpdateInput } from '@/types/user'

interface EditUserModalProps {
  isOpen: boolean
  user: UserResponse | null
  onClose: () => void
  onSave: (payload: UserUpdateInput) => Promise<void>
}

const accessLevelInfo: Record<AccessLevel, { label: string; description: string }> = {
  administrador: { label: 'Administrador', description: 'Controle total: usuários, integrações, configurações da empresa.' },
  supervisor: { label: 'Supervisor', description: 'Gerencia usuários, templates, números e webhooks.' },
  atendente: { label: 'Atendente', description: 'Envia mensagens, gerencia conversas, visualiza clientes.' },
}

/**
 * IMPORTANTE: o componente pai deve renderizar isto com `key={user?.id}` —
 * assim, cada usuário diferente aberto para edição monta uma instância nova
 * (useState pega o valor inicial certo), em vez de precisar sincronizar
 * estado manualmente quando `user` muda por baixo de uma instância já viva.
 */
export default function EditUserModal({ isOpen, user, onClose, onSave }: EditUserModalProps) {
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [role, setRole] = useState(user?.role ?? '')
  const [accessLevel, setAccessLevel] = useState<AccessLevel>(user?.access_level ?? 'atendente')
  const [sector, setSector] = useState(user?.sector ?? '')

  if (!isOpen || !user) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({ name, role, access_level: accessLevel, sector: sector || null })
      onClose()
    } catch (error) {
      console.error('Erro ao editar usuário:', error)
      alert(error instanceof Error ? error.message : 'Erro ao editar usuário. Tente novamente.')
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
          <h3 className="text-lg font-bold text-ink-900">Editar Usuário</h3>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Email</label>
            <input
              type="email"
              value={user.email}
              disabled
              className="w-full px-3 py-2 border border-ink-200 bg-ink-50 rounded-lg text-sm text-ink-500 cursor-not-allowed"
            />
            <p className="text-xs text-ink-400 mt-1">O email não pode ser alterado após o cadastro.</p>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-1.5">Setor</label>
            <input
              type="text"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
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
              {loading ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
