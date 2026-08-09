'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { CompanyResponse } from '@/types/company'

interface TabProps {
  company: CompanyResponse
  disabled: boolean
  onUpdated: (company: CompanyResponse) => void
}

export default function MetaTab({ company, disabled, onUpdated }: TabProps) {
  const [phoneNumberId, setPhoneNumberId] = useState('')
  const [businessAccountId, setBusinessAccountId] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [busy, setBusy] = useState(false)

  const meta = company.meta_connection
  const isConnected = meta.status === 'connected'

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    const parsed = new Date(date)
    if (Number.isNaN(parsed.getTime())) return '—'
    return parsed.toLocaleString('pt-BR')
  }

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/meta/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone_number_id: phoneNumberId,
          business_account_id: businessAccountId,
          access_token: accessToken,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao conectar Meta')
      onUpdated(data)
      setPhoneNumberId('')
      setBusinessAccountId('')
      setAccessToken('')
      toast.success('Meta conectada com sucesso.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao conectar Meta')
    } finally {
      setBusy(false)
    }
  }

  const handleDisconnect = async () => {
    setBusy(true)
    try {
      const response = await fetch(`/api/empresas/${company.id}/meta/disconnect`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao desconectar Meta')
      onUpdated(data)
      toast.success('Meta desconectada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao desconectar Meta')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <span
        className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${
          isConnected ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}
      >
        {isConnected ? 'Meta Conectada' : 'Meta Desconectada'}
      </span>

      {isConnected ? (
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-500">Phone Number ID</p>
            <p className="text-sm text-gray-900">{meta.phone_number_id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Business Account ID</p>
            <p className="text-sm text-gray-900">{meta.business_account_id}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Última sincronização</p>
            <p className="text-sm text-gray-900">{formatDate(meta.last_sync)}</p>
          </div>
          {!disabled && (
            <button
              disabled={busy}
              onClick={handleDisconnect}
              className="px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Desconectar
            </button>
          )}
        </div>
      ) : (
        !disabled && (
          <form onSubmit={handleConnect} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number ID</label>
              <input
                type="text"
                required
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Business Account ID</label>
              <input
                type="text"
                required
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Access Token</label>
              <input
                type="password"
                required
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {busy ? 'Conectando...' : 'Conectar Meta'}
            </button>
          </form>
        )
      )}
    </div>
  )
}
