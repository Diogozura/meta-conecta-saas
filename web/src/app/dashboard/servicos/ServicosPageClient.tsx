'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Search, Calendar } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { WhatsAppGlyph, InstagramGlyph } from '@/components/BrandIcons'

interface ContaServicos {
  id: string
  nome: string
  email: string
  servicosContratados: { whatsapp: boolean; agenda: boolean; instagram: boolean }
}

const MODULOS = [
  { key: 'whatsapp' as const, label: 'WhatsApp', icon: WhatsAppGlyph },
  { key: 'agenda' as const, label: 'Agenda', icon: Calendar },
  { key: 'instagram' as const, label: 'Instagram', icon: InstagramGlyph },
]

export default function ServicosPageClient() {
  const [contas, setContas] = useState<ContaServicos[] | null>(null)
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/servicos')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { contas: ContaServicos[] }) => setContas(data.contas))
      .catch(() => toast.error('Erro ao carregar as contas'))
  }, [])

  async function alternar(contaId: string, modulo: 'whatsapp' | 'agenda' | 'instagram') {
    if (!contas) return
    const conta = contas.find((c) => c.id === contaId)
    if (!conta) return

    const novosServicos = { ...conta.servicosContratados, [modulo]: !conta.servicosContratados[modulo] }
    setContas((prev) => prev?.map((c) => (c.id === contaId ? { ...c, servicosContratados: novosServicos } : c)) ?? null)
    setSalvando(contaId)
    try {
      const res = await fetch(`/api/admin/servicos/${contaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(novosServicos),
      })
      if (!res.ok) throw new Error()
      toast.success(`${conta.nome} atualizado.`)
    } catch {
      // Reverte em caso de erro — não deixa o toggle mentir sobre o estado salvo.
      setContas((prev) => prev?.map((c) => (c.id === contaId ? conta : c)) ?? null)
      toast.error('Erro ao salvar — tente de novo')
    } finally {
      setSalvando(null)
    }
  }

  const contasFiltradas = contas?.filter(
    (c) => c.nome.toLowerCase().includes(busca.toLowerCase()) || c.email.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="max-w-3xl">
      <div className="mb-4">
        <h1 className="text-lg font-bold text-ink-900">Serviços por conta</h1>
        <p className="text-sm text-ink-500 mt-1">
          Controla quais módulos cada conta enxerga no menu e consegue acessar. Uma conta sem nada configurado aqui tem acesso a
          tudo por padrão — só passa a restringir depois que você desmarca algum módulo dela.
        </p>
      </div>

      <div className="relative mb-4">
        <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          className="w-full pl-9 pr-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>

      {contas === null ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : contasFiltradas?.length === 0 ? (
        <p className="text-sm text-ink-400 text-center py-8">Nenhuma conta encontrada.</p>
      ) : (
        <div className="border border-ink-200 rounded-xl divide-y divide-ink-100 bg-white">
          {contasFiltradas?.map((conta) => (
            <div key={conta.id} className="px-4 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{conta.nome}</p>
                <p className="text-xs text-ink-500 truncate">{conta.email}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {salvando === conta.id && <Loader2 className="w-4 h-4 animate-spin text-ink-400" />}
                {MODULOS.map((m) => {
                  const Icon = m.icon
                  const ativo = conta.servicosContratados[m.key]
                  return (
                    <button
                      key={m.key}
                      onClick={() => alternar(conta.id, m.key)}
                      disabled={salvando === conta.id}
                      title={`${ativo ? 'Desativar' : 'Ativar'} ${m.label}`}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        ativo ? 'bg-brand-50 text-brand-700 border border-brand-200' : 'bg-ink-50 text-ink-400 border border-ink-200'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
