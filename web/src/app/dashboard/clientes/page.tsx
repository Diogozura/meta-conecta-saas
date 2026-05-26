'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Search, Phone, Mail, MoreHorizontal } from 'lucide-react'
import AddClientModal from './AddClientModal'
import { Cliente } from '@/types/database'

const tagColors: Record<string, string> = {
  Lead: 'bg-yellow-50 text-yellow-700',
  Cliente: 'bg-green-50 text-green-700',
  Inativo: 'bg-gray-100 text-gray-500',
  VIP: 'bg-purple-50 text-purple-700',
}

export default function ClientesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [clients, setClients] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  // Carregar clientes
  useEffect(() => {
    loadClients()
  }, [])

  const loadClients = async () => {
    try {
      const response = await fetch('/api/clientes')
      if (response.ok) {
        const data = await response.json()
        setClients(data.clientes || [])
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddClient = async (clientData: Omit<Cliente, 'id' | 'contaId' | 'dataCadastro' | 'dataAtualizacao' | 'status'>) => {
    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
      })

      if (response.ok) {
        await loadClients()
        setIsModalOpen(false)
      } else {
        throw new Error('Erro ao adicionar cliente')
      }
    } catch (error) {
      console.error('Erro ao adicionar cliente:', error)
      throw error
    }
  }

  const filteredClients = clients.filter(client =>
    client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.telefone?.includes(searchTerm)
  )

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">Gerencie seus contatos e clientes</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <UserPlus className="w-4 h-4" />
          Adicionar Cliente
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Carregando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tag</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredClients.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-green-700">{c.nome[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{c.nome}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-0.5">
                      {c.telefone && (
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {c.telefone}
                        </span>
                      )}
                      {c.email && (
                        <span className="flex items-center gap-1.5 text-gray-500">
                          <Mail className="w-3 h-3 text-gray-400" />
                          {c.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {c.tag && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors[c.tag] ?? 'bg-gray-100 text-gray-500'}`}>
                        {c.tag}
                      </span>
                    )}
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
      <AddClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddClient}
      />
    </div>
  )
}
