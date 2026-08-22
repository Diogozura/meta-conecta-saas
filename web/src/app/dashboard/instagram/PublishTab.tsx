'use client'

import { useEffect, useState } from 'react'
import { Image as ImageIcon, Clapperboard, Video, CircleDot, Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

type PublishType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES'

const TYPE_OPTIONS: { key: PublishType; label: string; icon: typeof ImageIcon; accept: string }[] = [
  { key: 'IMAGE', label: 'Post (foto)', icon: ImageIcon, accept: 'image/jpeg,image/png' },
  { key: 'VIDEO', label: 'Vídeo', icon: Video, accept: 'video/mp4,video/quicktime' },
  { key: 'REELS', label: 'Reels', icon: Clapperboard, accept: 'video/mp4,video/quicktime' },
  { key: 'STORIES', label: 'Story', icon: CircleDot, accept: 'image/jpeg,image/png,video/mp4,video/quicktime' },
]

interface Publicacao {
  id: string
  tipo: PublishType
  mediaUrl: string
  caption?: string
  status: 'enviando' | 'processando' | 'publicado' | 'falhou'
  erro?: string
  dataCriacao: string
}

const STATUS_LABEL: Record<Publicacao['status'], string> = {
  enviando: 'Enviando',
  processando: 'Processando',
  publicado: 'Publicado',
  falhou: 'Falhou',
}

const STATUS_CLASS: Record<Publicacao['status'], string> = {
  enviando: 'bg-ink-100 text-ink-600',
  processando: 'bg-amber-100 text-amber-700',
  publicado: 'bg-brand-100 text-brand-700',
  falhou: 'bg-red-100 text-red-700',
}

export default function PublishTab({ connected }: { connected: boolean }) {
  const [tipo, setTipo] = useState<PublishType>('IMAGE')
  const [file, setFile] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  async function loadHistory() {
    try {
      const res = await fetch('/api/instagram/publications')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar publicações')
      setPublicacoes(data.publicacoes ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingHistory(false)
    }
  }

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoadingHistory(false)
      return
    }
    loadHistory()
  }, [connected])

  // Continua consultando publicações "processando" (vídeo/reels ainda processando na Meta)
  useEffect(() => {
    const pendentes = publicacoes.filter((p) => p.status === 'processando')
    if (pendentes.length === 0) return

    const id = setInterval(() => {
      Promise.all(
        pendentes.map((p) =>
          fetch(`/api/instagram/publications/${p.id}`)
            .then((res) => res.json())
            .then((data) => data.publicacao as Publicacao | undefined)
            .catch(() => undefined),
        ),
      ).then((results) => {
        setPublicacoes((prev) =>
          prev.map((p) => results.find((r) => r?.id === p.id) ?? p),
        )
      })
    }, 4000)
    return () => clearInterval(id)
  }, [publicacoes])

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (!file) {
      toast.error('Selecione um arquivo primeiro.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetch('/api/instagram/media/upload', { method: 'POST', body: formData })
      const uploadJson = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadJson.error ?? 'Erro ao subir o arquivo')
      setUploading(false)

      setPublishing(true)
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaUrl: uploadJson.url, caption: caption.trim() || undefined, tipo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao publicar')

      toast.success(json.status === 'publicado' ? 'Publicado com sucesso!' : 'Publicação enviada — ainda processando.')
      setFile(null)
      setCaption('')
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar')
    } finally {
      setUploading(false)
      setPublishing(false)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para publicar conteúdo.</div>
  }

  const activeType = TYPE_OPTIONS.find((t) => t.key === tipo)!
  const busy = uploading || publishing

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handlePublish} className="bg-white rounded-xl border border-ink-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Tipo de publicação</label>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((t) => {
              const Icon = t.icon
              const active = tipo === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => { setTipo(t.key); setFile(null) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    active ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Arquivo</label>
          <label className="flex items-center gap-3 px-4 py-3 border border-dashed border-ink-300 rounded-lg cursor-pointer hover:bg-ink-50 transition-colors">
            <UploadCloud className="w-5 h-5 text-ink-400 shrink-0" />
            <span className="text-sm text-ink-600 truncate">{file ? file.name : `Escolher ${activeType.label.toLowerCase()}...`}</span>
            <input type="file" accept={activeType.accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Legenda</label>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
            placeholder="Escreva uma legenda (opcional)..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !file}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {uploading ? 'Enviando arquivo...' : publishing ? 'Publicando...' : 'Publicar'}
          </button>
        </div>
      </form>

      <div>
        <h3 className="text-sm font-semibold text-ink-800 mb-3">Publicações recentes</h3>
        {loadingHistory && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        )}
        {!loadingHistory && publicacoes.length === 0 && (
          <p className="text-sm text-ink-400">Nenhuma publicação feita pelo painel ainda.</p>
        )}
        {!loadingHistory && publicacoes.length > 0 && (
          <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
            {publicacoes.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-3">
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 ${STATUS_CLASS[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink-900 truncate">{p.caption || '(sem legenda)'}</p>
                  <p className="text-xs text-ink-500">{p.tipo} · {new Date(p.dataCriacao).toLocaleString('pt-BR')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
