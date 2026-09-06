'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { History } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'

interface Registro {
  id: string
  entidade: string
  descricao: string
  usuarioNome: string
  criadoEm: string
}

// Log de auditoria já existe pra conta inteira (fluxo, respostas rápidas, equipe...) — essa aba só
// filtra pro que é do módulo Instagram, pra dar visão completa de tudo que acontece aqui: conectar/
// desconectar a conta, publicar, agendar, reagendar, remover do histórico, mudar configuração
// (marca d'água, assinatura, guia de marca, termos proibidos), hashtags salvas e modelos de legenda.
const ENTIDADES_INSTAGRAM = new Set([
  'instagram_conta',
  'instagram_publicacao',
  'instagram_config',
  'conjunto_hashtags',
  'modelo_legenda',
])

export default function AuditoriaTab() {
  const [registros, setRegistros] = useState<Registro[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/auditoria')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { registros: Registro[] } | null) => {
        if (cancelled || !data) return
        setRegistros(data.registros.filter((r) => ENTIDADES_INSTAGRAM.has(r.entidade)))
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar o log de auditoria.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="max-w-2xl space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-ink-800">Log de auditoria do Instagram</h2>
        <p className="text-xs text-ink-500">Quem conectou a conta, publicou, agendou, reagendou ou mudou alguma configuração — mais recente primeiro.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
        </div>
      ) : !registros || registros.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500 flex flex-col items-center gap-2">
          <History className="w-6 h-6 text-ink-300" />
          Nenhuma mudança registrada ainda.
        </div>
      ) : (
        <div className="bg-white border border-ink-200 rounded-xl divide-y divide-ink-100 max-h-[70vh] overflow-y-auto">
          {registros.map((r) => (
            <div key={r.id} className="px-4 py-2.5">
              <p className="text-sm text-ink-900">{r.descricao}</p>
              <p className="text-[11px] text-ink-400 mt-0.5">
                {r.usuarioNome} · {new Date(r.criadoEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
