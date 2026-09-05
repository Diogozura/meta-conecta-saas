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
  Sparkles,
  Users,
  Type,
  Trash2,
  Copy,
  Pencil,
  Send,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import CropEditor, { CropThumb, exportCroppedFile, DEFAULT_CROP, type CropSettings } from './CropEditor'

type PublishType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
type WizardStep = 'upload' | 'crop' | 'share'
type BlockKey = 'collaborators' | 'altText' | 'ai'

const BLOCK_DEFS: { key: BlockKey; label: string; icon: typeof Users }[] = [
  { key: 'collaborators', label: 'Colaboradores', icon: Users },
  { key: 'altText', label: 'Texto alternativo', icon: Type },
  { key: 'ai', label: 'Conteúdo por IA', icon: Sparkles },
]

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
  altText?: string
  collaborators?: string[]
  isAiGenerated?: boolean
  itemCount?: number
  status: 'rascunho' | 'agendado' | 'enviando' | 'processando' | 'publicado' | 'falhou'
  agendadoPara?: string
  erro?: string
  dataCriacao: string
}

interface PublishItem {
  file: File
  crop: CropSettings
}

const STATUS_LABEL: Record<Publicacao['status'], string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  enviando: 'Enviando',
  processando: 'Processando',
  publicado: 'Publicado',
  falhou: 'Falhou',
}

const STATUS_CLASS: Record<Publicacao['status'], string> = {
  rascunho: 'bg-ink-100 text-ink-500',
  agendado: 'bg-blue-100 text-blue-700',
  enviando: 'bg-ink-100 text-ink-600',
  processando: 'bg-amber-100 text-amber-700',
  publicado: 'bg-brand-100 text-brand-700',
  falhou: 'bg-red-100 text-red-700',
}

function formatAgendadoPara(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function isImageFile(file: File) {
  return file.type.startsWith('image/')
}

export default function PublishTab({ connected }: { connected: boolean }) {
  const [tipo, setTipo] = useState<PublishType>('IMAGE')
  const [items, setItems] = useState<PublishItem[]>([])
  const [step, setStep] = useState<WizardStep>('upload')
  const [activeCropIndex, setActiveCropIndex] = useState(0)
  const [caption, setCaption] = useState('')
  const [altText, setAltText] = useState('')
  const [collaboratorsInput, setCollaboratorsInput] = useState('')
  const [isAiGenerated, setIsAiGenerated] = useState(false)
  const [shareToFeed, setShareToFeed] = useState(true)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [enabledBlocks, setEnabledBlocks] = useState<Set<BlockKey>>(new Set())
  const [dragActive, setDragActive] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publicacoes, setPublicacoes] = useState<Publicacao[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [agendarAberto, setAgendarAberto] = useState(false)
  const [agendadoParaInput, setAgendadoParaInput] = useState('')
  const [savingSchedule, setSavingSchedule] = useState<'rascunho' | 'agendado' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editAgendadoPara, setEditAgendadoPara] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)
  const [forcingId, setForcingId] = useState<string | null>(null)
  const [generatingCaption, setGeneratingCaption] = useState(false)

  const activeType = TYPE_OPTIONS.find((t) => t.key === tipo)!
  const isCarousel = tipo === 'CAROUSEL'
  const imageIndices = useMemo(() => items.reduce<number[]>((acc, it, i) => (isImageFile(it.file) ? [...acc, i] : acc), []), [items])
  const hasCropStep = (tipo === 'IMAGE' || tipo === 'CAROUSEL') && imageIndices.length > 0
  const itemsValid = isCarousel ? items.length >= MIN_CAROUSEL_ITEMS && items.length <= MAX_CAROUSEL_ITEMS : items.length === 1

  const previews = useMemo(() => items.map((it) => ({ file: it.file, url: URL.createObjectURL(it.file) })), [items])
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
    const incoming = Array.from(list).map((file) => ({ file, crop: { ...DEFAULT_CROP } }))
    if (incoming.length === 0) return
    if (isCarousel) {
      setItems((prev) => [...prev, ...incoming].slice(0, MAX_CAROUSEL_ITEMS))
    } else {
      setItems(incoming.slice(0, 1))
    }
  }

  function removeFile(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index))
  }

  function moveFile(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev]
      const target = index + direction
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function updateCrop(index: number, crop: CropSettings) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, crop } : it)))
  }

  function switchTipo(next: PublishType) {
    setTipo(next)
    setItems([])
    setStep('upload')
    if (next !== 'REELS') setCoverFile(null)
    if (next !== 'IMAGE') setEnabledBlocks((prev) => { const next2 = new Set(prev); next2.delete('altText'); return next2 })
  }

  function resetForm() {
    setItems([])
    setStep('upload')
    setActiveCropIndex(0)
    setCaption('')
    setAltText('')
    setCollaboratorsInput('')
    setIsAiGenerated(false)
    setShareToFeed(true)
    setCoverFile(null)
    setEnabledBlocks(new Set())
    setAgendarAberto(false)
    setAgendadoParaInput('')
  }

  function addBlock(key: BlockKey) {
    setEnabledBlocks((prev) => new Set(prev).add(key))
  }

  function removeBlock(key: BlockKey) {
    setEnabledBlocks((prev) => { const next = new Set(prev); next.delete(key); return next })
    if (key === 'collaborators') setCollaboratorsInput('')
    if (key === 'altText') setAltText('')
    if (key === 'ai') setIsAiGenerated(false)
  }

  function goToCropOrShare() {
    if (!itemsValid) {
      toast.error(isCarousel ? `Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.` : 'Selecione ao menos um arquivo.')
      return
    }
    if (hasCropStep) {
      setActiveCropIndex(imageIndices[0])
      setStep('crop')
    } else {
      setStep('share')
    }
  }

  function goBack() {
    if (step === 'share') setStep(hasCropStep ? 'crop' : 'upload')
    else if (step === 'crop') setStep('upload')
  }

  async function buildFormData(): Promise<FormData> {
    const finalFiles = await Promise.all(
      items.map((it) => (isImageFile(it.file) ? exportCroppedFile(it.file, it.crop) : Promise.resolve(it.file))),
    )

    const formData = new FormData()
    finalFiles.forEach((f) => formData.append('files', f))
    formData.append('tipo', tipo)
    if (caption.trim()) formData.append('caption', caption.trim())
    if (tipo === 'IMAGE' && altText.trim()) formData.append('altText', altText.trim())
    if (collaboratorsInput.trim()) formData.append('collaborators', collaboratorsInput.trim())
    if (isAiGenerated) formData.append('isAiGenerated', 'true')
    if (tipo === 'REELS') {
      formData.append('shareToFeed', String(shareToFeed))
      if (coverFile) formData.append('coverFile', coverFile)
    }
    return formData
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (step !== 'share') return
    if (!itemsValid) {
      toast.error(isCarousel ? `Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.` : 'Selecione ao menos um arquivo.')
      return
    }

    setPublishing(true)
    try {
      const formData = await buildFormData()
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

  async function handleSaveDraftOrSchedule(mode: 'rascunho' | 'agendado') {
    if (!itemsValid) {
      toast.error(isCarousel ? `Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.` : 'Selecione ao menos um arquivo.')
      return
    }
    if (mode === 'agendado' && !agendadoParaInput) {
      toast.error('Escolha a data e hora do agendamento.')
      return
    }

    setSavingSchedule(mode)
    try {
      const formData = await buildFormData()
      if (mode === 'agendado') formData.append('agendadoPara', new Date(agendadoParaInput).toISOString())

      const res = await fetch('/api/instagram/publish/schedule', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')

      toast.success(mode === 'agendado' ? 'Publicação agendada!' : 'Rascunho salvo.')
      resetForm()
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingSchedule(null)
    }
  }

  async function handleGenerateCaption() {
    const primeiraImagem = items.find((it) => isImageFile(it.file))
    if (!primeiraImagem) {
      toast.error('Selecione uma imagem primeiro.')
      return
    }
    setGeneratingCaption(true)
    try {
      const formData = new FormData()
      formData.append('file', primeiraImagem.file)
      const res = await fetch('/api/instagram/publish/caption-suggestion', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao gerar legenda')
      setCaption(json.caption)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao gerar legenda')
    } finally {
      setGeneratingCaption(false)
    }
  }

  function handleDuplicate(p: Publicacao) {
    switchTipo(p.tipo)
    setCaption(p.caption ?? '')
    setAltText(p.altText ?? '')
    setCollaboratorsInput((p.collaborators ?? []).join(', '))
    setIsAiGenerated(!!p.isAiGenerated)
    setEnabledBlocks(new Set([
      ...(p.altText ? (['altText'] as BlockKey[]) : []),
      ...(p.collaborators?.length ? (['collaborators'] as BlockKey[]) : []),
      ...(p.isAiGenerated ? (['ai'] as BlockKey[]) : []),
    ]))
    toast('Legenda e configurações copiadas — selecione o arquivo pra publicar de novo.')
  }

  function handleStartEdit(p: Publicacao) {
    setEditingId(p.id)
    setEditCaption(p.caption ?? '')
    setEditAgendadoPara(p.agendadoPara ? p.agendadoPara.slice(0, 16) : '')
  }

  async function handleSaveEdit(id: string, opts?: { publicarAgora?: boolean }) {
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = opts?.publicarAgora
        ? { publicarAgora: true }
        : {
          caption: editCaption,
          agendadoPara: editAgendadoPara ? new Date(editAgendadoPara).toISOString() : null,
        }
      const res = await fetch(`/api/instagram/publications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      toast.success(opts?.publicarAgora ? 'Publicando...' : 'Alterações salvas.')
      setEditingId(null)
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleForceNow(id: string) {
    setForcingId(id)
    try {
      const res = await fetch(`/api/instagram/publications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicarAgora: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao publicar')
      toast.success('Publicando...')
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao publicar')
    } finally {
      setForcingId(null)
    }
  }

  async function handleDeleteHistoryItem(id: string, status: Publicacao['status']) {
    const mensagem = status === 'rascunho' || status === 'agendado'
      ? 'Cancelar essa publicação? O arquivo enviado será descartado.'
      : 'Remover esta publicação do histórico do painel? O post publicado no Instagram não é afetado.'
    if (!window.confirm(mensagem)) return
    setDeletingId(id)
    try {
      const res = await fetch(`/api/instagram/publications/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao remover')
      setPublicacoes((prev) => prev.filter((p) => p.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao remover')
    } finally {
      setDeletingId(null)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para publicar conteúdo.</div>
  }

  return (
    <div className="max-w-3xl space-y-8">
      <form onSubmit={handlePublish} className="bg-white rounded-xl border border-ink-200 p-6 space-y-5">
        {step === 'upload' && (
          <>
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
                {isCarousel && <span className="ml-1.5 font-normal text-ink-400">({items.length}/{MAX_CAROUSEL_ITEMS}, mín. {MIN_CAROUSEL_ITEMS})</span>}
              </label>

              {items.length === 0 && (
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

              {items.length > 0 && (
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
                          {isCarousel && items.length > 1 && (
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
                                disabled={i === items.length - 1}
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
                    {isCarousel && items.length < MAX_CAROUSEL_ITEMS && (
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
                    <button type="button" onClick={() => setItems([])} className="text-xs text-ink-500 hover:text-ink-700 underline">
                      Trocar arquivo
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={goToCropOrShare}
                disabled={!itemsValid}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
              >
                Avançar
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {step === 'crop' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <h3 className="text-sm font-semibold text-ink-800">Cortar</h3>
              <button type="button" onClick={() => setStep('share')} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                Avançar
              </button>
            </div>

            {items.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it, i) => {
                  const imgOk = isImageFile(it.file)
                  return (
                    <button
                      key={previews[i]?.url ?? i}
                      type="button"
                      disabled={!imgOk}
                      onClick={() => setActiveCropIndex(i)}
                      className={`relative shrink-0 rounded-md overflow-hidden border-2 ${
                        activeCropIndex === i ? 'border-brand-600' : 'border-transparent'
                      } ${!imgOk ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      {imgOk ? (
                        <CropThumb url={previews[i].url} settings={it.crop} size={56} />
                      ) : (
                        <video src={previews[i]?.url} className="w-14 h-14 object-cover" muted />
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex justify-center py-2">
              {items[activeCropIndex] && isImageFile(items[activeCropIndex].file) ? (
                <CropEditor
                  url={previews[activeCropIndex].url}
                  settings={items[activeCropIndex].crop}
                  onChange={(next) => updateCrop(activeCropIndex, next)}
                />
              ) : (
                <p className="text-sm text-ink-400 py-8 text-center">Vídeos não são cortados aqui — serão publicados no formato original.</p>
              )}
            </div>
          </div>
        )}

        {step === 'share' && (
          <>
            <div className="flex items-center justify-between">
              <button type="button" onClick={goBack} className="flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900">
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
              <h3 className="text-sm font-semibold text-ink-800">Nova publicação</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleSaveDraftOrSchedule('rascunho')}
                  disabled={!!savingSchedule || publishing}
                  className="text-sm font-medium text-ink-600 hover:text-ink-900 disabled:opacity-50"
                >
                  {savingSchedule === 'rascunho' ? 'Salvando...' : 'Salvar rascunho'}
                </button>
                <button
                  type="button"
                  onClick={() => setAgendarAberto((v) => !v)}
                  disabled={!!savingSchedule || publishing}
                  className="text-sm font-medium text-ink-600 hover:text-ink-900 disabled:opacity-50"
                >
                  Agendar
                </button>
                <button
                  type="submit"
                  disabled={publishing || !!savingSchedule}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {publishing ? 'Publicando...' : 'Publicar agora'}
                </button>
              </div>
            </div>

            {agendarAberto && (
              <div className="flex items-center gap-2 rounded-lg border border-ink-200 p-3">
                <input
                  type="datetime-local"
                  value={agendadoParaInput}
                  onChange={(e) => setAgendadoParaInput(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  className="flex-1 px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => handleSaveDraftOrSchedule('agendado')}
                  disabled={savingSchedule === 'agendado'}
                  className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
                >
                  {savingSchedule === 'agendado' ? 'Agendando...' : 'Confirmar'}
                </button>
              </div>
            )}

            <div className="flex gap-3">
              {previews[0] && (
                isImageFile(items[0].file) ? (
                  <CropThumb url={previews[0].url} settings={items[0].crop} size={64} />
                ) : (
                  <video src={previews[0].url} className="w-16 h-16 object-cover rounded" muted />
                )
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-ink-700">Legenda</label>
                  <div className="flex items-center gap-2">
                    {isImageFile(items[0]?.file) && (
                      <button
                        type="button"
                        onClick={handleGenerateCaption}
                        disabled={generatingCaption}
                        className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                      >
                        {generatingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {generatingCaption ? 'Gerando...' : 'Sugerir com IA'}
                      </button>
                    )}
                    <span className={`text-xs ${caption.length > CAPTION_LIMIT ? 'text-red-600' : 'text-ink-400'}`}>{caption.length}/{CAPTION_LIMIT}</span>
                  </div>
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

            <div className="space-y-3">
              {enabledBlocks.has('altText') && tipo === 'IMAGE' && (
                <div className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><Type className="w-3.5 h-3.5 text-ink-400" /> Texto alternativo</label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${altText.length > ALT_TEXT_LIMIT ? 'text-red-600' : 'text-ink-400'}`}>{altText.length}/{ALT_TEXT_LIMIT}</span>
                      <button type="button" onClick={() => removeBlock('altText')} className="text-ink-400 hover:text-red-600" aria-label="Remover texto alternativo"><X className="w-3.5 h-3.5" /></button>
                    </div>
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

              {enabledBlocks.has('collaborators') && (
                <div className="rounded-lg border border-ink-200 p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><Users className="w-3.5 h-3.5 text-ink-400" /> Colaboradores</label>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs ${collaboratorsCount > 3 ? 'text-red-600' : 'text-ink-400'}`}>{collaboratorsCount}/3</span>
                      <button type="button" onClick={() => removeBlock('collaborators')} className="text-ink-400 hover:text-red-600" aria-label="Remover colaboradores"><X className="w-3.5 h-3.5" /></button>
                    </div>
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
              )}

              {enabledBlocks.has('ai') && (
                <div className="rounded-lg border border-ink-200 p-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAiGenerated} onChange={(e) => setIsAiGenerated(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                    <span className="flex items-center gap-1.5 text-sm text-ink-700"><Sparkles className="w-3.5 h-3.5 text-ink-400" /> Conteúdo gerado por IA</span>
                  </label>
                  <button type="button" onClick={() => removeBlock('ai')} className="text-ink-400 hover:text-red-600" aria-label="Remover selo de IA"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {BLOCK_DEFS.filter((b) => (b.key !== 'altText' || tipo === 'IMAGE') && !enabledBlocks.has(b.key)).map((b) => {
                  const Icon = b.icon
                  return (
                    <button
                      key={b.key}
                      type="button"
                      onClick={() => addBlock(b.key)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-ink-300 text-xs font-medium text-ink-600 hover:border-brand-400 hover:text-brand-700 hover:bg-brand-50 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5" />
                      + {b.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </>
        )}
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
            {publicacoes.map((p) => {
              const editavel = p.status === 'rascunho' || p.status === 'agendado'
              return (
                <div key={p.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 ${STATUS_CLASS[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 truncate">{p.caption || '(sem legenda)'}</p>
                      <p className="text-xs text-ink-500">
                        {p.tipo}{p.tipo === 'CAROUSEL' && p.itemCount ? ` · ${p.itemCount} itens` : ''}
                        {p.status === 'agendado' && p.agendadoPara ? ` · agendado pra ${formatAgendadoPara(p.agendadoPara)}` : ` · ${new Date(p.dataCriacao).toLocaleString('pt-BR')}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => handleDuplicate(p)} className="p-1.5 text-ink-400 hover:text-brand-600" aria-label="Duplicar" title="Duplicar (legenda e configurações, escolha o arquivo de novo)">
                        <Copy className="w-4 h-4" />
                      </button>
                      {editavel && (
                        <>
                          <button type="button" onClick={() => handleStartEdit(p)} className="p-1.5 text-ink-400 hover:text-brand-600" aria-label="Editar" title="Editar legenda/agendamento">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleForceNow(p.id)}
                            disabled={forcingId === p.id}
                            className="p-1.5 text-ink-400 hover:text-brand-600 disabled:opacity-50"
                            aria-label="Publicar agora"
                            title="Publicar agora"
                          >
                            {forcingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteHistoryItem(p.id, p.status)}
                        disabled={deletingId === p.id}
                        className="p-1.5 text-ink-400 hover:text-red-600 disabled:opacity-50"
                        aria-label={editavel ? 'Cancelar' : 'Remover do histórico'}
                        title={editavel ? 'Cancelar' : 'Remover do histórico (não apaga do Instagram)'}
                      >
                        {deletingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {editingId === p.id && (
                    <div className="ml-1 pl-3 border-l-2 border-brand-200 space-y-2">
                      <textarea
                        value={editCaption}
                        onChange={(e) => setEditCaption(e.target.value)}
                        rows={2}
                        maxLength={CAPTION_LIMIT}
                        className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        placeholder="Legenda"
                      />
                      <div className="flex items-center gap-2">
                        <input
                          type="datetime-local"
                          value={editAgendadoPara}
                          onChange={(e) => setEditAgendadoPara(e.target.value)}
                          min={new Date().toISOString().slice(0, 16)}
                          className="flex-1 px-3 py-1.5 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-ink-500 hover:text-ink-700">Cancelar</button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(p.id)}
                          disabled={savingEdit}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                        >
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-ink-400">Deixe a data em branco pra virar rascunho (sem agendamento).</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
