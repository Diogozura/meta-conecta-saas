'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Image as ImageIcon,
  Images,
  Clapperboard,
  Video,
  CircleDot,
  Loader2,
  UploadCloud,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Sparkles,
  Users,
  Type,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

type PublishType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'

const MIN_CAROUSEL_ITEMS = 2
const MAX_CAROUSEL_ITEMS = 10
const CAPTION_LIMIT = 2200
const ALT_TEXT_LIMIT = 1000

const TYPE_OPTIONS: { key: PublishType; label: string; hint: string; icon: typeof ImageIcon; accept: string; multiple?: boolean }[] = [
  { key: 'IMAGE', label: 'Post (foto)', hint: 'Uma foto no feed', icon: ImageIcon, accept: 'image/jpeg,image/png' },
  { key: 'CAROUSEL', label: 'Carrossel', hint: '2 a 10 fotos/vídeos', icon: Images, accept: 'image/jpeg,image/png,video/mp4,video/quicktime', multiple: true },
  { key: 'VIDEO', label: 'Vídeo', hint: 'Vídeo no feed', icon: Video, accept: 'video/mp4,video/quicktime' },
  { key: 'REELS', label: 'Reels', hint: 'Vídeo curto vertical', icon: Clapperboard, accept: 'video/mp4,video/quicktime' },
  { key: 'STORIES', label: 'Story', hint: 'Some em 24h', icon: CircleDot, accept: 'image/jpeg,image/png,video/mp4,video/quicktime' },
]

interface Publicacao {
  id: string
  tipo: PublishType
  caption?: string
  itemCount?: number
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
  const [files, setFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [altText, setAltText] = useState('')
  const [collaboratorsInput, setCollaboratorsInput] = useState('')
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [shareToFeed, setShareToFeed] = useState(true)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  const activeType = TYPE_OPTIONS.find((t) => t.key === tipo)!
  const isCarousel = tipo === 'CAROUSEL'

  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files])
  useEffect(() => () => { previews.forEach((p) => URL.revokeObjectURL(p.url)) }, [previews])

  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile])
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])

  const collaboratorsCount = collaboratorsInput.split(',').map((u) => u.trim()).filter(Boolean).length

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

  // Continua consultando publicações "processando" (vídeo/reels/carrossel ainda processando na Meta)
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

  function addFiles(list: FileList | File[]) {
    const incoming = Array.from(list)
    if (incoming.length === 0) return
    if (isCarousel) {
      setFiles((prev) => [...prev, ...incoming].slice(0, MAX_CAROUSEL_ITEMS))
    } else {
      setFiles(incoming.slice(0, 1))
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function moveFile(index: number, direction: -1 | 1) {
    setFiles((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function switchTipo(next: PublishType) {
    setTipo(next)
    setFiles([])
    if (next !== 'REELS') setCoverFile(null)
  }

  function resetForm() {
    setFiles([])
    setCaption('')
    setAltText('')
    setCollaboratorsInput('')
    setIsAiGenerated(false)
    setShareToFeed(true)
    setCoverFile(null)
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) {
      toast.error('Selecione ao menos um arquivo.')
      return
    }
    if (isCarousel && (files.length < MIN_CAROUSEL_ITEMS || files.length > MAX_CAROUSEL_ITEMS)) {
      toast.error(`Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.`)
      return
    }

    setPublishing(true)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('tipo', tipo)
      if (caption.trim()) formData.append('caption', caption.trim())
      if (tipo === 'IMAGE' && altText.trim()) formData.append('altText', altText.trim())
      if (collaboratorsInput.trim()) formData.append('collaborators', collaboratorsInput.trim())
      if (isAiGenerated) formData.append('isAiGenerated', 'true')
      if (tipo === 'REELS') {
        formData.append('shareToFeed', String(shareToFeed))
        if (coverFile) formData.append('coverFile', coverFile)
      }

      const res = await fetch('/api/instagram/publish', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao publicar')

      toast.success(json.status === 'publicado' ? 'Publicado com sucesso!' : 'Publicação enviada — ainda processando.')
      resetForm()
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar')
    } finally {
      setPublishing(false)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para publicar conteúdo.</div>
  }

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handlePublish} className="bg-white rounded-xl border border-ink-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">Tipo de publicação</label>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {TYPE_OPTIONS.map((t) => {
              const Icon = t.icon
              const active = tipo === t.key
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => switchTipo(t.key)}
                  className={`flex flex-col items-center justify-center gap-1 px-2 py-3 rounded-lg text-center border transition-colors ${
                    active ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium leading-tight">{t.label}</span>
                  <span className={`text-[10px] leading-tight ${active ? 'text-brand-100' : 'text-ink-400'}`}>{t.hint}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink-700 mb-2">
            Arquivo{isCarousel ? 's' : ''}
            {isCarousel && <span className="ml-1.5 font-normal text-ink-400">({files.length}/{MAX_CAROUSEL_ITEMS}, mín. {MIN_CAROUSEL_ITEMS})</span>}
          </label>

          {files.length === 0 && (
            <label
              onDragOver={(e) => { e.preventDefault(); setDragActive(true) }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); addFiles(e.dataTransfer.files) }}
              className={`flex flex-col items-center justify-center gap-2 px-4 py-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                dragActive ? 'border-brand-400 bg-brand-50' : 'border-ink-300 hover:bg-ink-50'
              }`}
            >
              <UploadCloud className="w-6 h-6 text-ink-400" />
              <span className="text-sm text-ink-600">
                Arraste {isCarousel ? 'as fotos/vídeos' : `o ${activeType.label.toLowerCase()}`} aqui ou clique para escolher
              </span>
              <span className="text-xs text-ink-400">{isCarousel ? 'JPEG, PNG, MP4 ou MOV' : activeType.accept.replace(/,/g, ', ').replace(/\w+\//g, '').toUpperCase()}</span>
              <input
                type="file"
                accept={activeType.accept}
                multiple={isCarousel}
                className="hidden"
                onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
              />
            </label>
          )}

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {previews.map((p, i) => {
                  const isVideo = p.file.type.startsWith('video/')
                  return (
                    <div key={p.url} className="relative group aspect-square rounded-lg overflow-hidden border border-ink-200 bg-ink-50">
                      {isVideo ? (
                        <video src={p.url} className="w-full h-full object-cover" muted />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element -- preview de arquivo local (blob:), não faz sentido pelo componente de otimização de imagem do Next
                        <img src={p.url} alt="" className="w-full h-full object-cover" />
                      )}
                      {isCarousel && (
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">{i + 1}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center"
                        aria-label="Remover"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      {isCarousel && files.length > 1 && (
                        <div className="absolute bottom-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => moveFile(i, -1)}
                            disabled={i === 0}
                            className="bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white rounded w-5 h-5 flex items-center justify-center"
                            aria-label="Mover para trás"
                          >
                            <ArrowLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveFile(i, 1)}
                            disabled={i === files.length - 1}
                            className="bg-black/60 hover:bg-black/80 disabled:opacity-30 text-white rounded w-5 h-5 flex items-center justify-center"
                            aria-label="Mover para frente"
                          >
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
                {isCarousel && files.length < MAX_CAROUSEL_ITEMS && (
                  <label className="aspect-square rounded-lg border-2 border-dashed border-ink-300 hover:bg-ink-50 cursor-pointer flex items-center justify-center text-ink-400">
                    <UploadCloud className="w-5 h-5" />
                    <input
                      type="file"
                      accept={activeType.accept}
                      multiple
                      className="hidden"
                      onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = '' }}
                    />
                  </label>
                )}
              </div>
              {!isCarousel && (
                <button type="button" onClick={() => setFiles([])} className="text-xs text-ink-500 hover:text-ink-700 underline">
                  Trocar arquivo
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-ink-700">Legenda</label>
            <span className={`text-xs ${caption.length > CAPTION_LIMIT ? 'text-red-600' : 'text-ink-400'}`}>{caption.length}/{CAPTION_LIMIT}</span>
          </div>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            maxLength={CAPTION_LIMIT}
            className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
            placeholder="Escreva uma legenda (opcional)... use #hashtags e @menções"
          />
          <p className="mt-1 text-xs text-ink-400">Máx. 2.200 caracteres, 30 hashtags e 20 menções.</p>
        </div>

        {tipo === 'REELS' && (
          <div className="space-y-3 rounded-lg border border-ink-200 p-4">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-ink-700">
                Compartilhar também no Feed
                <span className="block text-xs text-ink-400 font-normal">Se desligado, o Reels aparece só na aba Reels.</span>
              </span>
              <input type="checkbox" checked={shareToFeed} onChange={(e) => setShareToFeed(e.target.checked)} className="w-4 h-4 accent-brand-600 shrink-0 ml-3" />
            </label>

            <div>
              <label className="block text-sm text-ink-700 mb-1.5">Capa personalizada <span className="text-ink-400 font-normal">(opcional)</span></label>
              {coverPreview ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- preview de arquivo local (blob:) */}
                  <img src={coverPreview} alt="" className="w-14 h-14 object-cover rounded-lg border border-ink-200" />
                  <button type="button" onClick={() => setCoverFile(null)} className="text-xs text-ink-500 hover:text-red-600 underline">Remover capa</button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-ink-300 rounded-lg cursor-pointer hover:bg-ink-50 text-xs text-ink-600">
                  <UploadCloud className="w-4 h-4 text-ink-400" />
                  Escolher imagem de capa
                  <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            Opções avançadas
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-4 rounded-lg border border-ink-200 p-4">
              {tipo === 'IMAGE' && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><Type className="w-3.5 h-3.5 text-ink-400" /> Texto alternativo</label>
                    <span className={`text-xs ${altText.length > ALT_TEXT_LIMIT ? 'text-red-600' : 'text-ink-400'}`}>{altText.length}/{ALT_TEXT_LIMIT}</span>
                  </div>
                  <input
                    type="text"
                    value={altText}
                    onChange={(e) => setAltText(e.target.value)}
                    maxLength={ALT_TEXT_LIMIT}
                    placeholder="Descreva a imagem para leitores de tela"
                    className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-sm text-ink-700"><Users className="w-3.5 h-3.5 text-ink-400" /> Colaboradores</label>
                  <span className={`text-xs ${collaboratorsCount > 3 ? 'text-red-600' : 'text-ink-400'}`}>{collaboratorsCount}/3</span>
                </div>
                <input
                  type="text"
                  value={collaboratorsInput}
                  onChange={(e) => setCollaboratorsInput(e.target.value)}
                  placeholder="usuario1, usuario2"
                  className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
                />
                <p className="mt-1 text-xs text-ink-400">Até 3 @usuários, separados por vírgula. Eles precisam aceitar o convite pra aparecer como autores.</p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={isAiGenerated} onChange={(e) => setIsAiGenerated(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                <span className="flex items-center gap-1.5 text-sm text-ink-700"><Sparkles className="w-3.5 h-3.5 text-ink-400" /> Conteúdo gerado por IA</span>
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={publishing || files.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
          >
            {publishing && <Loader2 className="w-4 h-4 animate-spin" />}
            {publishing ? 'Publicando...' : 'Publicar'}
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
                  <p className="text-xs text-ink-500">
                    {p.tipo}{p.tipo === 'CAROUSEL' && p.itemCount ? ` · ${p.itemCount} itens` : ''} · {new Date(p.dataCriacao).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
