'use client'

import { useEffect, useState } from 'react'
import { Heart, MessageCircle, Info, AtSign } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

interface ActivityItem {
  tipo: 'comentario' | 'mencao'
  id: string
  text?: string
  username?: string
  timestamp?: string
  mediaThumb?: string
}

interface ActivityData {
  items: ActivityItem[]
  totalLikes: number
  totalComments: number
  postsConsiderados: number
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function ActivityPanel({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ActivityData | null>(null)

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/instagram/activity')
      .then((res) => res.json())
      .then((json) => {
        if (json.error) throw new Error(json.error)
        setData(json)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar atividade recente'))
      .finally(() => setLoading(false))
  }, [connected])

  if (!connected) return null

  if (loading) {
    return (
      <div className="max-w-2xl space-y-3 mt-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }

  if (!data || data.postsConsiderados === 0) return null

  return (
    <div className="max-w-2xl space-y-4 mt-8">
      <h3 className="text-sm font-semibold text-ink-800">Atividade recente</h3>

      <div className="bg-white rounded-xl border border-ink-200 p-4 flex gap-8">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-red-500" />
          <div>
            <p className="text-lg font-semibold text-ink-900">{data.totalLikes.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-ink-500">curtidas nos últimos {data.postsConsiderados} posts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-brand-600" />
          <div>
            <p className="text-lg font-semibold text-ink-900">{data.totalComments.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-ink-500">comentários nos últimos {data.postsConsiderados} posts</p>
          </div>
        </div>
      </div>

      {data.items.length > 0 && (
        <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
          {data.items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 p-3">
              {item.mediaThumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
                <img src={item.mediaThumb} alt="" className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-ink-100 flex items-center justify-center shrink-0">
                  {item.tipo === 'mencao' && <AtSign className="w-4 h-4 text-ink-400" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink-900 truncate"><span className="font-semibold">@{item.username}</span> {item.text}</p>
                <p className="text-[11px] text-ink-400 mt-0.5">{formatDate(item.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-ink-400">
        <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
        <p>Curtidas mostram só o total por publicação — a API do Instagram não permite listar quem curtiu. Menções aparecem aqui assim que a Meta notificar uma pela primeira vez (não é possível buscar menções antigas).</p>
      </div>
    </div>
  )
}
