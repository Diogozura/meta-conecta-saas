'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Plus, Mail, Shield, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'
import type { AccessLevel, UserCreateInput, UserResponse, UserUpdateInput } from '@/types/user'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

const accessLevelColors: Record<AccessLevel, string> = {
  administrador: 'bg-purple-50 text-purple-700',
  supervisor: 'bg-blue-50 text-blue-700',
  atendente: 'bg-green-50 text-green-700',
}

const accessLevelLabels: Record<AccessLevel, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  atendente: 'Atendente',
}

const PAGE_SIZE = 50

export default function UsersTab({ company, disabled }: TabProps) {
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [busy, setBusy] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  // Se a última página buscada veio cheia (== PAGE_SIZE), pode haver mais.
  const [lastPageWasFull, setLastPageWasFull] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('atendente')
  const [sector, setSector] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState('')
  const [editSector, setEditSector] = useState('')
  const [editAccessLevel, setEditAccessLevel] = useState<AccessLevel>('atendente')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/users`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar usuários')
      const page: UserResponse[] = data.users || []
      setUsers(page)
      setLastPageWasFull(page.length === PAGE_SIZE)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar usuários')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    const lastUserId = users[users.length - 1]?.id
    if (!lastUserId) return
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/users?cursor=${encodeURIComponent(lastUserId)}`)
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar mais usuários')
      const page: UserResponse[] = data.users || []
      setUsers((prev) => [...prev, ...page])
      setLastPageWasFull(page.length === PAGE_SIZE)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar mais usuários')
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais abas/telas do dashboard
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  const resetForm = () => {
    setName('')
    setEmail('')
    setRole('')
    setAccessLevel('atendente')
    setSector('')
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const payload: UserCreateInput = { name, email, role, access_level: accessLevel, sector: sector || null }
      const response = await fetch(`/api/empresas/${company.id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao adicionar usuário')
      setInviteLink(data.invite_link)
      setCopied(false)
      resetForm()
      setShowForm(false)
      await loadUsers()
      toast.success('Usuário adicionado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar usuário')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (user: UserResponse) => {
    setEditingId(user.id)
    setEditName(user.name)
    setEditRole(user.role)
    setEditSector(user.sector ?? '')
    setEditAccessLevel(user.access_level)
  }

  const cancelEdit = () => setEditingId(null)

  const saveEdit = async (userId: string) => {
    if (!editName.trim() || !editRole.trim()) {
      toast.error('Nome e cargo são obrigatórios.')
      return
    }
    setBusy(true)
    try {
      const payload: UserUpdateInput = {
        name: editName,
        role: editRole,
        access_level: editAccessLevel,
        sector: editSector || null,
      }
      const response = await fetch(`/api/empresas/${company.id}/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao editar usuário')
      setEditingId(null)
      await loadUsers()
      toast.success('Usuário atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao editar usuário')
    } finally {
      setBusy(false)
    }
  }

  const toggleStatus = async (user: UserResponse) => {
    const nextStatus = user.status === 'ativo' ? 'inativo' : 'ativo'
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao atualizar status')
      await loadUsers()
      toast.success('Status atualizado.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao atualizar status')
    } finally {
      setBusy(false)
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando usuários...</p>
  }

  return (
    <div className="space-y-4">
      {inviteLink && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 space-y-1.5">
          <p className="font-medium">Usuário adicionado. Link de convite:</p>
          <p className="break-all text-blue-800">{inviteLink}</p>
          <button
            onClick={handleCopyInvite}
            className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-blue-300 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {users.length === 0 && <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>}
        {users.map((user) =>
          editingId === user.id ? (
            <div key={user.id} className="border border-green-300 rounded-lg p-3 space-y-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="text"
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                placeholder="Cargo"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="text"
                value={editSector}
                onChange={(e) => setEditSector(e.target.value)}
                placeholder="Setor"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <select
                value={editAccessLevel}
                onChange={(e) => setEditAccessLevel(e.target.value as AccessLevel)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="administrador">Administrador</option>
                <option value="supervisor">Supervisor</option>
                <option value="atendente">Atendente</option>
              </select>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  onClick={() => saveEdit(user.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div key={user.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {user.role}
                  {user.sector ? ` · ${user.sector}` : ''}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Shield className="w-3 h-3 text-gray-400" />
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accessLevelColors[user.access_level]}`}>
                    {accessLevelLabels[user.access_level]}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      user.status === 'ativo' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
              </div>
              {!disabled && (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => startEdit(user)}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => toggleStatus(user)}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                  >
                    {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              )}
            </div>
          )
        )}
      </div>

      {lastPageWasFull && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="w-full px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loadingMore ? 'Carregando...' : 'Carregar mais usuários'}
        </button>
      )}

      {!disabled && (
        <div className="border-t border-gray-200 pt-4">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Adicionar usuário
            </button>
          ) : (
            <form onSubmit={handleCreate} className="space-y-2">
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome completo"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="text"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="Cargo (ex: Atendente de Vendas)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="text"
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="Setor"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <select
                value={accessLevel}
                onChange={(e) => setAccessLevel(e.target.value as AccessLevel)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              >
                <option value="administrador">Administrador</option>
                <option value="supervisor">Supervisor</option>
                <option value="atendente">Atendente</option>
              </select>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false)
                    resetForm()
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {busy ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
