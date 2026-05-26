'use client'

import { useState } from 'react'
import { X, Info } from 'lucide-react'
import { NivelUsuario } from '@/types/database'

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onAdd: (user: {
    nome: string
    email: string
    nivel: NivelUsuario
    status: 'ativo' | 'inativo' | 'convite_pendente'
  }) => Promise<void>
}

export default function AddUserModal({ isOpen, onClose, onAdd }: AddUserModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    nivel: NivelUsuario.OPERADOR,
    enviarConvite: true,
  })

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onAdd({
        nome: formData.nome,
        email: formData.email,
        nivel: formData.nivel,
        status: formData.enviarConvite ? 'convite_pendente' : 'ativo',
      })
      setFormData({ nome: '', email: '', nivel: NivelUsuario.OPERADOR, enviarConvite: true })
      onClose()
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error)
      alert('Erro ao adicionar usuário. Tente novamente.')
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
          <h3 className="text-lg font-bold text-gray-900">Adicionar Usuário</h3>
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
              Nome Completo <span className="text-red-500">*</span>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              placeholder="Ex: joao@empresa.com"
            />
          </div>

          {/* Nível de Acesso */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nível de Acesso <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={formData.nivel}
              onChange={(e) => setFormData({ ...formData, nivel: e.target.value as NivelUsuario })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              <option value={NivelUsuario.PROPRIETARIO}>Proprietário - Acesso total</option>
              <option value={NivelUsuario.ADMIN}>Admin - Gerencia usuários, templates e números</option>
              <option value={NivelUsuario.OPERADOR}>Operador - Envia mensagens e gerencia conversas</option>
              <option value={NivelUsuario.VISUALIZADOR}>Visualizador - Apenas leitura</option>
            </select>
            
            {/* Info sobre permissões */}
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <div className="flex gap-2">
                <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <div className="text-xs text-blue-700">
                  {formData.nivel === NivelUsuario.PROPRIETARIO && (
                    <p><strong>Proprietário:</strong> Controle total da conta, incluindo exclusão e gerenciamento de todos os recursos.</p>
                  )}
                  {formData.nivel === NivelUsuario.ADMIN && (
                    <p><strong>Admin:</strong> Pode adicionar/remover usuários, criar templates, conectar números e configurar webhooks.</p>
                  )}
                  {formData.nivel === NivelUsuario.OPERADOR && (
                    <p><strong>Operador:</strong> Pode enviar mensagens, gerenciar conversas, visualizar clientes e templates.</p>
                  )}
                  {formData.nivel === NivelUsuario.VISUALIZADOR && (
                    <p><strong>Visualizador:</strong> Apenas visualização de dados, sem permissão para realizar ações.</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Enviar Convite */}
          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
            <input
              type="checkbox"
              id="enviarConvite"
              checked={formData.enviarConvite}
              onChange={(e) => setFormData({ ...formData, enviarConvite: e.target.checked })}
              className="mt-0.5 w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
            />
            <label htmlFor="enviarConvite" className="text-sm text-gray-700">
              <span className="font-medium">Enviar convite por email</span>
              <p className="text-xs text-gray-500 mt-0.5">
                O usuário receberá um email para criar sua senha e acessar o sistema
              </p>
            </label>
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
              {loading ? 'Adicionando...' : 'Adicionar Usuário'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
