'use client'

import { useState, useEffect } from 'react'
import { UserPlus, Search, Shield, Mail, Calendar, MoreHorizontal, Copy, Check, X } from 'lucide-react'
import AddUserModal from './AddUserModal'
import EditUserModal from './EditUserModal'
import { Skeleton } from '@/components/Skeleton'
import type { AccessLevel, UserCreateInput, UserResponse, UserStatus, UserUpdateInput } from '@/types/user'

const accessLevelColors: Record<AccessLevel, string> = {
  administrador: 'bg-purple-50 text-purple-700',
  supervisor: 'bg-blue-50 text-blue-700',
  atendente: 'bg-brand-50 text-brand-700',
}

const accessLevelLabels: Record<AccessLevel, string> = {
  administrador: 'Administrador',
  supervisor: 'Supervisor',
  atendente: 'Atendente',
}

export default function UsuariosPage() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null)
  const [users, setUsers] = useState<UserResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [inviteInfo, setInviteInfo] = useState<{ name: string; link: string } | null>(null)
  const [copied, setCopied] = useState(false)
  // null = ainda carregando; usado pra decidir quais ações mostrar, espelhando
  // exatamente as regras de permissão do backend (require_role em users_router.py).
  const [me, setMe] = useState<{ id: string; accessLevel: AccessLevel } | null>(null)

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

  const loadMe = async () => {
    try {
      const response = await fetch('/api/me')
      if (response.ok) {
        const data = await response.json()
        setMe({ id: data.id, accessLevel: data.access_level })
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    loadUsers()
    loadMe()
  }, [])

  // Mesmas regras de app/api/routers/users_router.py: criar/editar exige
  // administrador ou supervisor; ativar/desativar exige administrador.
  const canManageUsers = me?.accessLevel === 'administrador' || me?.accessLevel === 'supervisor'
  const canToggleStatus = me?.accessLevel === 'administrador'

  const handleAddUser = async (payload: UserCreateInput) => {
    const response = await fetch('/api/usuarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao adicionar usuário')
    }
    await loadUsers()
    setInviteInfo({ name: data.user.name, link: data.invite_link })
    setCopied(false)
  }

  const handleEditUser = async (payload: UserUpdateInput) => {
    if (!editingUser) return
    const response = await fetch(`/api/usuarios/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao editar usuário')
    }
    await loadUsers()
  }

  const toggleStatus = async (user: UserResponse) => {
    const nextStatus: UserStatus = user.status === 'ativo' ? 'inativo' : 'ativo'
    try {
      const response = await fetch(`/api/usuarios/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Erro ao atualizar status')
      }
      await loadUsers()
    } catch (error) {
      console.error('Erro ao atualizar status:', error)
      alert(error instanceof Error ? error.message : 'Erro ao atualizar status')
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteInfo) return
    await navigator.clipboard.writeText(inviteInfo.link)
    setCopied(true)
  }

  const filteredUsers = users.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const formatDate = (date: unknown) => {
    if (!date) return '—'
    const parsed = new Date(date as string | number | Date)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Usuários</h2>
          <p className="text-sm text-ink-500">Gerencie os usuários e permissões da sua empresa</p>
        </div>
        {canManageUsers && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Adicionar Usuário
          </button>
        )}
      </div>

      {/* Banner de convite pós-criação */}
      {inviteInfo && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start justify-between gap-3">
          <div className="text-sm text-blue-900">
            <p className="font-medium">Usuário {inviteInfo.name} adicionado.</p>
            <p className="text-blue-800 mt-0.5 break-all">Link de convite: {inviteInfo.link}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyInvite}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 text-xs font-medium rounded-lg hover:bg-blue-100 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              onClick={() => setInviteInfo(null)}
              className="p-1.5 rounded-md text-blue-400 hover:text-blue-600 hover:bg-blue-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-ink-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input
            type="text"
            placeholder="Buscar usuário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-x-auto">
        {!loading && filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-ink-500">
            {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Usuário</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Email</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Cargo</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Nível</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider">Cadastro</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-ink-500 uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {loading && Array.from({ length: 5 }).map((_, i) => <UserRowSkeleton key={i} />)}
              {!loading && filteredUsers.map((user) => {
                const isSelf = me?.id === user.id
                const showMenu = (canManageUsers || canToggleStatus) && !isSelf
                return (
                  <tr key={user.id} className="hover:bg-ink-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-brand-700">{user.name[0]}</span>
                        </div>
                        <span className="font-medium text-ink-900">
                          {user.name}
                          {isSelf && <span className="text-xs text-ink-400 font-normal"> (você)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-ink-600">
                        <Mail className="w-3 h-3 text-ink-400" />
                        {user.email}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-600">{user.role}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-ink-400" />
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accessLevelColors[user.access_level]}`}>
                          {accessLevelLabels[user.access_level]}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          user.status === 'ativo' ? 'bg-brand-50 text-brand-700' : 'bg-ink-100 text-ink-500'
                        }`}
                      >
                        {user.status === 'ativo' ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5 text-ink-500">
                        <Calendar className="w-3 h-3 text-ink-400" />
                        {formatDate(user.created_at)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {showMenu && (
                        <UserActionsMenu
                          user={user}
                          canEdit={canManageUsers && !isSelf}
                          canToggleStatus={canToggleStatus && !isSelf}
                          onEdit={() => setEditingUser(user)}
                          onToggleStatus={toggleStatus}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {canManageUsers && (
        <>
          <AddUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onAdd={handleAddUser} />
          <EditUserModal
            key={editingUser?.id}
            isOpen={editingUser !== null}
            user={editingUser}
            onClose={() => setEditingUser(null)}
            onSave={handleEditUser}
          />
        </>
      )}
    </div>
  )
}

function UserRowSkeleton() {
  return (
    <tr>
      <td className="px-5 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-full shrink-0" />
          <Skeleton className="h-4 w-28" />
        </div>
      </td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-36" /></td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-24" /></td>
      <td className="px-5 py-3"><Skeleton className="h-5 w-20 rounded-full" /></td>
      <td className="px-5 py-3"><Skeleton className="h-5 w-14 rounded-full" /></td>
      <td className="px-5 py-3"><Skeleton className="h-4 w-20" /></td>
      <td className="px-5 py-3" />
    </tr>
  )
}

function UserActionsMenu({
  user,
  canEdit,
  canToggleStatus,
  onEdit,
  onToggleStatus,
}: {
  user: UserResponse
  canEdit: boolean
  canToggleStatus: boolean
  onEdit: () => void
  onToggleStatus: (user: UserResponse) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-md text-ink-400 hover:text-ink-600 hover:bg-ink-100 transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-40 bg-white border border-ink-200 rounded-lg shadow-lg py-1">
            {canEdit && (
              <button
                onClick={() => {
                  setOpen(false)
                  onEdit()
                }}
                className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
              >
                Editar
              </button>
            )}
            {canToggleStatus && (
              <button
                onClick={() => {
                  setOpen(false)
                  onToggleStatus(user)
                }}
                className="w-full text-left px-3 py-2 text-sm text-ink-700 hover:bg-ink-50"
              >
                {user.status === 'ativo' ? 'Desativar' : 'Ativar'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
