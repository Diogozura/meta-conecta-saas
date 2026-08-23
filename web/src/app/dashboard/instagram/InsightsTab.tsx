'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

interface InsightValue {
  name: string
  title?: string
  values?: Array<{ value: number; end_time?: string }>
  total_value?: { value: number }
}

const METRIC_LABELS: Record<string, string> = {
  reach: 'Alcance',
  accounts_engaged: 'Contas engajadas',
  total_interactions: 'Interações totais',
  likes: 'Curtidas',
  comments: 'Comentários',
  shares: 'Compartilhamentos',
  saves: 'Salvamentos',
}

function totalValue(insight: InsightValue) {
  if (insight.total_value) return insight.total_value.value ?? 0
  return (insight.values ?? []).reduce((sum, v) => sum + (v.value ?? 0), 0)
}

export default function InsightsTab({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(true)
  const [insights, setInsights] = useState<InsightValue[]>([])

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/instagram/insights')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setInsights(data.insights ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar métricas'))
      .finally(() => setLoading(false))
  }, [connected])

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para ver as métricas.</div>
  }

  if (loading) {
    return (
      <div className="flex flex-wrap gap-4">
        {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 w-40 rounded-xl" />)}
      </div>
    )
  }

  if (insights.length === 0) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Nenhuma métrica disponível ainda — a Meta leva alguns dias para começar a reportar dados novos.</div>
  }

  return (
    <div className="bg-white rounded-xl border border-ink-200 p-6">
      <p className="text-sm text-ink-500 mb-4">Últimos 24h, por métrica reportada pela Meta.</p>
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        {insights.map((insight) => (
          <div key={insight.name}>
            <p className="text-2xl font-semibold text-ink-900">{totalValue(insight).toLocaleString('pt-BR')}</p>
            <p className="text-xs text-ink-500">{METRIC_LABELS[insight.name] ?? insight.title ?? insight.name}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
