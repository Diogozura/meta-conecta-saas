'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Search, Shield, Mail, Calendar, MoreHorizontal } from 'lucide-react'
import AddUserModal from './AddUserModal'
import { Usuario, NivelUsuario } from '@/types/database'

const nivelColors: Record<string, string> = {
  proprietario: 'bg-purple-50 text-purple-700',
  admin: 'bg-blue-50 text-blue-700',
  operador: 'bg-green-50 text-green-700',
  visualizador: 'bg-gray-100 text-gray-500',
}

const nivelLabels: Record<string, string> = {
  proprietario: 'Proprietário',
  admin: 'Admin',
  operador: 'Operador',
  visualizador: 'Visualizador',
}

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [users, setUsers] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Carregar usuários
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/usuarios')
      if (response.ok) {
        const data = await response.json()
        setUsers(data.usuarios || [])
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUser = async (userData: Omit<Usuario, 'id' | 'contaId' | 'dataCadastro' | 'dataAtualizacao'>) => {
    try {
      const response = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      if (response.ok) {
        await loadUsers()
        setIsModalOpen(false)
      } else {
        throw new Error('Erro ao adicionar usuário')
      }
    } catch (error) {
      console.error('Erro ao adicionar usuário:', error)
      throw error
    }
  }

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Usuários</h2>
          <p className="text-sm text-gray-500">Gerencie os usuários e permissões da conta</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Adicionar Usuário
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando usuários...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nível</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Cadastro</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-green-700">{user.nome[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{user.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-gray-600">
                      <Mail className="w-3 h-3 text-gray-400" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-gray-400" />
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${nivelColors[user.nivel] ?? 'bg-gray-100 text-gray-500'}`}>
                        {nivelLabels[user.nivel] ?? user.nivel}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.status === 'ativo' ? 'bg-green-50 text-green-700' :
                      user.status === 'convite_pendente' ? 'bg-yellow-50 text-yellow-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>
                      {user.status === 'ativo' ? 'Ativo' :
                       user.status === 'convite_pendente' ? 'Convite Pendente' :
                       'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5 text-gray-500">
                      <Calendar className="w-3 h-3 text-gray-400" />
                      {formatDate(user.dataCadastro)}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      <AddUserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddUser}
      />
    </div>
  )
}
