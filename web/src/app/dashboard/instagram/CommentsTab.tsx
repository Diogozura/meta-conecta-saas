'use client'

import { useEffect, useState } from 'react'
import { Loader2, MessageCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

interface Media {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  comments_count?: number
}

interface Comment {
  id: string
  text: string
  username?: string
  timestamp?: string
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CommentsTab({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(true)
  const [media, setMedia] = useState<Media[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/instagram/media')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setMedia(data.media ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar publicações'))
      .finally(() => setLoading(false))
  }, [connected])

  async function toggleExpand(mediaId: string) {
    if (expandedId === mediaId) {
      setExpandedId(null)
      return
    }
    setExpandedId(mediaId)
    if (comments[mediaId]) return

    setLoadingComments(mediaId)
    try {
      const res = await fetch(`/api/instagram/media/${mediaId}/comments`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar comentários')
      setComments((prev) => ({ ...prev, [mediaId]: data.comments ?? [] }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar comentários')
    } finally {
      setLoadingComments(null)
    }
  }

  async function handleReply(mediaId: string, commentId: string) {
    const message = replyText[commentId]?.trim()
    if (!message) return

    setReplying(commentId)
    try {
      const res = await fetch(`/api/instagram/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mediaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao responder')
      toast.success('Resposta publicada.')
      setReplyText((prev) => ({ ...prev, [commentId]: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao responder comentário')
    } finally {
      setReplying(null)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para gerenciar comentários.</div>
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  if (media.length === 0) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Nenhuma publicação encontrada.</div>
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {media.map((m) => (
        <div key={m.id} className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <button onClick={() => toggleExpand(m.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-50 transition-colors">
            {m.thumbnail_url || m.media_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
              <img src={m.thumbnail_url ?? m.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-ink-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-900 truncate">{m.caption ?? '(sem legenda)'}</p>
              <p className="text-xs text-ink-500 mt-0.5">{formatDate(m.timestamp)}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-ink-500 shrink-0">
              <MessageCircle className="w-3.5 h-3.5" />
              {m.comments_count ?? 0}
            </div>
          </button>

          {expandedId === m.id && (
            <div className="border-t border-ink-100 p-3 space-y-3 bg-ink-50">
              {loadingComments === m.id && <p className="text-xs text-ink-400 text-center py-4">Carregando comentários...</p>}
              {loadingComments !== m.id && (comments[m.id]?.length ?? 0) === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">Nenhum comentário ainda.</p>
              )}
              {loadingComments !== m.id && comments[m.id]?.map((c) => (
                <div key={c.id} className="bg-white rounded-lg border border-ink-200 p-3 space-y-2">
                  <p className="text-xs text-ink-900"><span className="font-semibold">{c.username ? `@${c.username}` : 'Usuário do Instagram'}</span> {c.text}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={replyText[c.id] ?? ''}
                      onChange={(e) => setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                      placeholder="Responder..."
                      className="flex-1 px-2.5 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                    />
                    <button
                      onClick={() => handleReply(m.id, c.id)}
                      disabled={replying === c.id || !replyText[c.id]?.trim()}
                      className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
                    >
                      {replying === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
