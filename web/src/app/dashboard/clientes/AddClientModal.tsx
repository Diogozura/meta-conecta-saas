'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

interface AddClientModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (client: {
    nome: string
    email?: string
    telefone?: string
    whatsapp?: string
    tag?: string
    notas?: string
  }) => Promise<void>
}

export default function AddClientModal({ isOpen, onClose, onAdd }: AddClientModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    whatsapp: '',
    tag: 'Lead',
    notas: '',
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onAdd({
        nome: formData.nome,
        email: formData.email || undefined,
        telefone: formData.telefone || undefined,
        whatsapp: formData.whatsapp || undefined,
        tag: formData.tag || undefined,
        notas: formData.notas || undefined,
      })
      setFormData({ nome: '', email: '', telefone: '', whatsapp: '', tag: 'Lead', notas: '' })
      onClose()
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      alert('Erro ao adicionar cliente. Tente novamente.')
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
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h3 className="text-lg font-bold text-gray-900">Adicionar Cliente</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nome <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Ex: João Silva"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Ex: joao@email.com"
            />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone</label>
            <input
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Ex: +55 11 99999-0001"
            />
          </div>

          {/* WhatsApp */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp</label>
            <input
              type="tel"
              value={formData.whatsapp}
              onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Ex: 5511999990001"
            />
          </div>

          {/* Tag */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tag</label>
            <select
              value={formData.tag}
              onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value="Lead">Lead</option>
              <option value="Cliente">Cliente</option>
              <option value="Inativo">Inativo</option>
              <option value="VIP">VIP</option>
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label>
            <textarea
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
              rows={3}
              placeholder="Informações adicionais..."
            />
          </div>

          {/* Actions */}
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
              {loading ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
