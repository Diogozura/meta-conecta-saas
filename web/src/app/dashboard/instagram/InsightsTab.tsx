'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Heart, MessageCircle } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'

interface InsightValue {
  name: string
  title?: string
  values?: Array<{ value: number; end_time?: string }>
  total_value?: { value: number }
}

interface InstagramMedia {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  comments_count?: number
  like_count?: number
}

interface ContactBreakdownItem {
  type: string
  label: string
  value: number
}

interface InsightsResponse {
  insights: InsightValue[]
  contactBreakdown: ContactBreakdownItem[]
  totals: { followers_count?: number; follows_count?: number; media_count?: number } | null
  followerGrowth: { net: number; follows?: number; unfollows?: number } | null
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

const PERIOD_OPTIONS: { key: 'day' | 'week' | 'days_28'; label: string }[] = [
  { key: 'day', label: 'Últimas 24h' },
  { key: 'week', label: '7 dias' },
  { key: 'days_28', label: 'Este mês' },
]

function totalValue(insight: InsightValue) {
  if (insight.total_value) return insight.total_value.value ?? 0
  return (insight.values ?? []).reduce((sum, v) => sum + (v.value ?? 0), 0)
}

function MetricGrid({ insights }: { insights: InsightValue[] }) {
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-4">
      {insights.map((insight) => (
        <div key={insight.name}>
          <p className="text-2xl font-semibold text-ink-900">{totalValue(insight).toLocaleString('pt-BR')}</p>
          <p className="text-xs text-ink-500">{METRIC_LABELS[insight.name] ?? insight.title ?? insight.name}</p>
        </div>
      ))}
    </div>
  )
}

export default function InsightsTab({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'day' | 'week' | 'days_28'>('day')
  const [data, setData] = useState<InsightsResponse | null>(null)
  const [media, setMedia] = useState<InstagramMedia[]>([])
  const [loadingMedia, setLoadingMedia] = useState(true)

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    setLoading(true)
    fetch(`/api/instagram/insights?period=${period}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar métricas'))
      .finally(() => setLoading(false))
  }, [connected, period])

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoadingMedia(false)
      return
    }
    fetch('/api/instagram/media')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setMedia(json.media ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar conteúdo compartilhado'))
      .finally(() => setLoadingMedia(false))
  }, [connected])

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para ver as métricas.</div>
  }

  const periodLabel = PERIOD_OPTIONS.find((p) => p.key === period)!.label

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              period === p.key ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-24 w-40 rounded-xl" />)}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="bg-white rounded-xl border border-ink-200 p-6">
            <p className="text-sm text-ink-500 mb-4">{periodLabel}, por métrica reportada pela Meta.</p>
            {data.insights.length > 0
              ? <MetricGrid insights={data.insights} />
              : <p className="text-sm text-ink-400">Nenhuma métrica disponível ainda — a Meta leva alguns dias para começar a reportar dados novos.</p>}
          </div>

          {(data.totals || data.followerGrowth) && (
            <div className="bg-white rounded-xl border border-ink-200 p-6">
              <p className="text-sm text-ink-500 mb-4">Seguidores e publicações.</p>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {data.totals?.followers_count !== undefined && (
                  <div>
                    <p className="text-2xl font-semibold text-ink-900">{data.totals.followers_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-ink-500">Seguidores totais</p>
                  </div>
                )}
                {data.followerGrowth && (
                  <div>
                    <p className={`text-2xl font-semibold ${data.followerGrowth.net > 0 ? 'text-brand-700' : 'text-ink-900'}`}>
                      {data.followerGrowth.net > 0 ? '+' : ''}{data.followerGrowth.net.toLocaleString('pt-BR')}
                    </p>
                    <p className="text-xs text-ink-500">
                      Novos seguidores ({periodLabel.toLowerCase()})
                      {data.followerGrowth.follows !== undefined && data.followerGrowth.unfollows !== undefined && (
                        <> · {data.followerGrowth.follows.toLocaleString('pt-BR')} seguiram, {data.followerGrowth.unfollows.toLocaleString('pt-BR')} deixaram de seguir</>
                      )}
                    </p>
                  </div>
                )}
                {data.totals?.follows_count !== undefined && (
                  <div>
                    <p className="text-2xl font-semibold text-ink-900">{data.totals.follows_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-ink-500">Seguindo</p>
                  </div>
                )}
                {data.totals?.media_count !== undefined && (
                  <div>
                    <p className="text-2xl font-semibold text-ink-900">{data.totals.media_count.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-ink-500">Publicações totais</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {data.contactBreakdown.length > 0 && (
            <div className="bg-white rounded-xl border border-ink-200 p-6">
              <p className="text-sm text-ink-500 mb-4">Toques nos botões de contato do perfil ({periodLabel.toLowerCase()}).</p>
              <div className="flex flex-wrap gap-x-8 gap-y-4">
                {data.contactBreakdown.map((item) => (
                  <div key={item.type}>
                    <p className="text-2xl font-semibold text-ink-900">{item.value.toLocaleString('pt-BR')}</p>
                    <p className="text-xs text-ink-500">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h3 className="text-sm font-semibold text-ink-800 mb-3">Conteúdo que você compartilhou</h3>
        {loadingMedia && (
          <div className="flex flex-wrap gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-40 rounded-xl" />)}
          </div>
        )}
        {!loadingMedia && media.length === 0 && (
          <p className="text-sm text-ink-400">Nenhuma publicação encontrada ainda.</p>
        )}
        {!loadingMedia && media.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {media.map((m) => (
              <a
                key={m.id}
                href={m.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-40 bg-white rounded-xl border border-ink-200 overflow-hidden hover:border-brand-300 transition-colors"
              >
                <div className="w-40 h-40 bg-ink-100">
                  {(m.thumbnail_url || m.media_url) && (
                    // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
                    <img src={m.thumbnail_url || m.media_url} alt={m.caption ?? 'Publicação do Instagram'} className="w-40 h-40 object-cover" />
                  )}
                </div>
                <div className="p-2 flex items-center justify-between text-xs text-ink-600">
                  <span className="flex items-center gap-1"><Heart className="w-3.5 h-3.5" />{(m.like_count ?? 0).toLocaleString('pt-BR')}</span>
                  <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" />{(m.comments_count ?? 0).toLocaleString('pt-BR')}</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
