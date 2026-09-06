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
  Hash,
  Layers,
  Droplet,
  FileText,
  PenLine,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import CropEditor, { CropThumb, exportCroppedFile, DEFAULT_CROP, type CropSettings } from './CropEditor'
import { encontrarHashtagsArriscadas } from '@/lib/hashtagsArriscadas'

type PublishType = 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
type WizardStep = 'upload' | 'crop' | 'share'
type BlockKey = 'collaborators' | 'altText' | 'ai' | 'hashtags' | 'watermark' | 'captionTemplate' | 'signature'

const BLOCK_DEFS: { key: BlockKey; label: string; icon: typeof Users }[] = [
  { key: 'collaborators', label: 'Colaboradores', icon: Users },
  { key: 'altText', label: 'Texto alternativo', icon: Type },
  { key: 'ai', label: 'Conteúdo por IA', icon: Sparkles },
  { key: 'hashtags', label: 'Hashtags salvas', icon: Hash },
  { key: 'captionTemplate', label: 'Modelo de legenda', icon: FileText },
  { key: 'watermark', label: 'Marca d’água', icon: Droplet },
  { key: 'signature', label: 'Assinatura', icon: PenLine },
]

interface ConjuntoHashtags {
  id: string
  nome: string
  hashtags: string
}

interface ModeloLegenda {
  id: string
  nome: string
  gancho: string
  corpo: string
  cta: string
}

interface InstagramPublishConfig {
  assinatura?: string
  assinaturaAtiva?: boolean
  marcaDaguaUrl?: string
  marcaDaguaAtiva?: boolean
}

const HASHTAG_LIMIT = 30
const MENTION_LIMIT = 20

const INTERVALO_LOTE_OPTIONS = [
  { value: 1, label: 'Diariamente' },
  { value: 2, label: 'A cada 2 dias' },
  { value: 7, label: 'Semanalmente' },
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

/**
 * "Agora" no formato que o input datetime-local espera (YYYY-MM-DDTHH:mm), em horário LOCAL —
 * `toISOString()` sozinho devolve UTC, e usar isso como `min` faz o seletor bloquear qualquer
 * horário antes de "agora + fuso" (3h a mais no Brasil), empurrando todo agendamento pra mais
 * tarde do que a pessoa realmente escolheu.
 */
function nowLocalForInput(): string {
  const agora = new Date()
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

/** Mesma conversão de `nowLocalForInput`, mas a partir de uma data qualquer (ex: editar um agendamento já salvo). */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
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
  const [conjuntosHashtags, setConjuntosHashtags] = useState<ConjuntoHashtags[] | null>(null)
  const [novoHashtagNome, setNovoHashtagNome] = useState('')
  const [novoHashtagTexto, setNovoHashtagTexto] = useState('')
  const [loteAberto, setLoteAberto] = useState(false)
  const [loteFiles, setLoteFiles] = useState<File[]>([])
  const [loteCaption, setLoteCaption] = useState('')
  const [lotePrimeiraData, setLotePrimeiraData] = useState('')
  const [loteIntervalo, setLoteIntervalo] = useState(1)
  const [loteSaving, setLoteSaving] = useState(false)
  const [publishConfig, setPublishConfig] = useState<InstagramPublishConfig>({})
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [applyWatermark, setApplyWatermark] = useState(false)
  const [modelosLegenda, setModelosLegenda] = useState<ModeloLegenda[] | null>(null)
  const [novoModeloNome, setNovoModeloNome] = useState('')
  const [novoModeloGancho, setNovoModeloGancho] = useState('')
  const [novoModeloCorpo, setNovoModeloCorpo] = useState('')
  const [novoModeloCta, setNovoModeloCta] = useState('')
  const [assinaturaInput, setAssinaturaInput] = useState('')
  const [assinaturaAutoInput, setAssinaturaAutoInput] = useState(false)
  const [collabSuggestions, setCollabSuggestions] = useState<string[] | null>(null)
  const [showCollabDropdown, setShowCollabDropdown] = useState(false)

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
  const hashtagCount = useMemo(() => (caption.match(/#[\p{L}0-9_]+/gu) ?? []).length, [caption])
  const mentionCount = useMemo(() => (caption.match(/@[\p{L}0-9_.]+/gu) ?? []).length, [caption])
  const hashtagsArriscadas = useMemo(() => encontrarHashtagsArriscadas(caption), [caption])

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

  // Carrega a assinatura/marca d'água salvas da conta — e já pré-preenche a legenda com a
  // assinatura se "incluir automaticamente" estiver ativo (fica só como texto normal, editável).
  useEffect(() => {
    if (!connected) return
    fetch('/api/conta/instagram-publish-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { config: InstagramPublishConfig } | null) => {
        const config = data?.config ?? {}
        setPublishConfig(config)
        setAssinaturaInput(config.assinatura ?? '')
        setAssinaturaAutoInput(!!config.assinaturaAtiva)
        setApplyWatermark(!!config.marcaDaguaAtiva)
        if (config.assinaturaAtiva && config.assinatura) {
          setCaption((prev) => (prev ? prev : config.assinatura!))
        }
      })
      .catch(() => {})
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
    // Stories/Reels têm um formato vertical único de verdade (9:16) — feed é mais tolerante
    // (a Meta aceita de 4:5 a 1.91:1), então só forçamos um aspecto padrão nesses dois tipos.
    const aspectoPadrao = tipo === 'STORIES' || tipo === 'REELS' ? '9:16' : DEFAULT_CROP.aspect
    const incoming = Array.from(list).map((file) => ({ file, crop: { ...DEFAULT_CROP, aspect: aspectoPadrao } }))
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
    if (key === 'hashtags' && conjuntosHashtags === null) {
      fetch('/api/hashtag-sets')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { conjuntos: ConjuntoHashtags[] } | null) => setConjuntosHashtags(data?.conjuntos ?? []))
        .catch(() => setConjuntosHashtags([]))
    }
    if (key === 'captionTemplate' && modelosLegenda === null) {
      fetch('/api/caption-templates')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { modelos: ModeloLegenda[] } | null) => setModelosLegenda(data?.modelos ?? []))
        .catch(() => setModelosLegenda([]))
    }
    if (key === 'collaborators' && collabSuggestions === null) {
      fetch('/api/instagram/collaborator-suggestions')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { usernames: string[] } | null) => setCollabSuggestions(data?.usernames ?? []))
        .catch(() => setCollabSuggestions([]))
    }
  }

  // Segmento sendo digitado agora (depois da última vírgula) — é nele que o autocomplete filtra.
  function collabCurrentSegment(): string {
    const parts = collaboratorsInput.split(',')
    return parts[parts.length - 1].trim().replace(/^@/, '').toLowerCase()
  }

  function pickCollaborator(username: string) {
    const parts = collaboratorsInput.split(',')
    parts[parts.length - 1] = ` ${username}`
    setCollaboratorsInput(parts.join(',').replace(/^ /, '') + ', ')
    setShowCollabDropdown(false)
  }

  function aplicarModeloLegenda(m: ModeloLegenda) {
    const texto = [m.gancho, m.corpo, m.cta].filter(Boolean).join('\n\n')
    if (caption.trim() && !window.confirm('Substituir a legenda atual pelo modelo escolhido?')) return
    setCaption(texto)
  }

  async function handleCriarModeloLegenda() {
    if (!novoModeloNome.trim() || (!novoModeloGancho.trim() && !novoModeloCorpo.trim() && !novoModeloCta.trim())) return
    try {
      const res = await fetch('/api/caption-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoModeloNome.trim(), gancho: novoModeloGancho.trim(), corpo: novoModeloCorpo.trim(), cta: novoModeloCta.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setModelosLegenda((prev) => [...(prev ?? []), json.modelo])
      setNovoModeloNome('')
      setNovoModeloGancho('')
      setNovoModeloCorpo('')
      setNovoModeloCta('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar modelo de legenda')
    }
  }

  async function handleSalvarAssinatura() {
    try {
      const res = await fetch('/api/conta/instagram-publish-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assinatura: assinaturaInput, assinaturaAtiva: assinaturaAutoInput }),
      })
      if (!res.ok) throw new Error('Erro ao salvar assinatura')
      setPublishConfig((prev) => ({ ...prev, assinatura: assinaturaInput, assinaturaAtiva: assinaturaAutoInput }))
      toast.success('Assinatura salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar assinatura')
    }
  }

  async function handleUploadLogo(file: File) {
    setUploadingLogo(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/conta/instagram-publish-config/logo', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao subir o logo')
      setPublishConfig((prev) => ({ ...prev, marcaDaguaUrl: json.marcaDaguaUrl, marcaDaguaAtiva: true }))
      setApplyWatermark(true)
      toast.success('Logo salvo — vai aparecer como marca d’água nas publicações.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao subir o logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  function inserirHashtags(texto: string) {
    setCaption((prev) => (prev.trim() ? `${prev.trim()} ${texto}` : texto))
  }

  async function handleCriarConjuntoHashtags() {
    if (!novoHashtagNome.trim() || !novoHashtagTexto.trim()) return
    try {
      const res = await fetch('/api/hashtag-sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: novoHashtagNome.trim(), hashtags: novoHashtagTexto.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setConjuntosHashtags((prev) => [...(prev ?? []), json.conjunto])
      setNovoHashtagNome('')
      setNovoHashtagTexto('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar conjunto de hashtags')
    }
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
    const marcaDagua = { url: publishConfig.marcaDaguaUrl ?? '', ativa: applyWatermark && !!publishConfig.marcaDaguaUrl }
    const finalFiles = await Promise.all(
      items.map((it) => (isImageFile(it.file) ? exportCroppedFile(it.file, it.crop, marcaDagua) : Promise.resolve(it.file))),
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

  async function handleImportarLote() {
    if (loteFiles.length === 0) {
      toast.error('Selecione ao menos uma imagem.')
      return
    }
    if (!lotePrimeiraData) {
      toast.error('Escolha a data do primeiro post.')
      return
    }
    setLoteSaving(true)
    try {
      const formData = new FormData()
      loteFiles.forEach((f) => formData.append('files', f))
      if (loteCaption.trim()) formData.append('caption', loteCaption.trim())
      formData.append('primeiraData', new Date(lotePrimeiraData).toISOString())
      formData.append('intervaloDias', String(loteIntervalo))

      const res = await fetch('/api/instagram/publish/schedule/batch', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao importar')

      toast.success(`${json.criadas.length} publicações agendadas!`)
      setLoteAberto(false)
      setLoteFiles([])
      setLoteCaption('')
      setLotePrimeiraData('')
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar em lote')
    } finally {
      setLoteSaving(false)
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
    setEditAgendadoPara(p.agendadoPara ? isoToLocalInput(p.agendadoPara) : '')
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
      <div className="bg-white rounded-xl border border-ink-200 p-4">
        <button type="button" onClick={() => setLoteAberto((v) => !v)} className="flex items-center gap-2 text-sm font-medium text-ink-700 hover:text-brand-700">
          <Layers className="w-4 h-4" /> Importar em lote (várias fotos de uma vez)
        </button>

        {loteAberto && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-ink-500">Cada foto vira um post agendado (só imagem, sem recorte), espaçado automaticamente a partir da primeira data.</p>

            <label className="flex flex-col items-center justify-center gap-1.5 px-4 py-6 border-2 border-dashed border-ink-300 rounded-lg cursor-pointer hover:bg-ink-50">
              <UploadCloud className="w-5 h-5 text-ink-400" />
              <span className="text-sm text-ink-600">{loteFiles.length > 0 ? `${loteFiles.length} imagem(ns) selecionada(s)` : 'Escolher imagens'}</span>
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                className="hidden"
                onChange={(e) => setLoteFiles(e.target.files ? Array.from(e.target.files) : [])}
              />
            </label>

            <textarea
              value={loteCaption}
              onChange={(e) => setLoteCaption(e.target.value)}
              rows={2}
              placeholder="Legenda compartilhada por todos os posts (opcional)"
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />

            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={lotePrimeiraData}
                onChange={(e) => setLotePrimeiraData(e.target.value)}
                min={nowLocalForInput()}
                className="flex-1 px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
              <select
                value={loteIntervalo}
                onChange={(e) => setLoteIntervalo(Number(e.target.value))}
                className="px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              >
                {INTERVALO_LOTE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {loteFiles.length > 0 && lotePrimeiraData && (
              <ul className="text-xs text-ink-500 space-y-0.5 max-h-32 overflow-y-auto">
                {loteFiles.map((f, i) => {
                  const d = new Date(new Date(lotePrimeiraData).getTime() + i * loteIntervalo * 86400000)
                  return <li key={i}>Post {i + 1} → {d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</li>
                })}
              </ul>
            )}

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLoteAberto(false)} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-900">Cancelar</button>
              <button
                type="button"
                onClick={handleImportarLote}
                disabled={loteSaving}
                className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {loteSaving ? 'Agendando...' : `Agendar ${loteFiles.length || ''} posts`}
              </button>
            </div>
          </div>
        )}
      </div>

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
                  min={nowLocalForInput()}
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
                <p className="mt-1 text-xs flex flex-wrap gap-x-3">
                  <span className={hashtagCount > HASHTAG_LIMIT ? 'text-red-600 font-medium' : 'text-ink-400'}>{hashtagCount}/{HASHTAG_LIMIT} hashtags</span>
                  <span className={mentionCount > MENTION_LIMIT ? 'text-red-600 font-medium' : 'text-ink-400'}>{mentionCount}/{MENTION_LIMIT} menções</span>
                </p>
                {hashtagsArriscadas.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Frequentemente sinalizadas por uso excessivo (não é confirmação de shadowban): {hashtagsArriscadas.map((h) => `#${h}`).join(', ')}</span>
                  </p>
                )}
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

              {enabledBlocks.has('collaborators') && (() => {
                const segmento = collabCurrentSegment()
                const sugestoes = segmento && collabSuggestions
                  ? collabSuggestions.filter((u) => u.toLowerCase().includes(segmento)).slice(0, 6)
                  : []
                return (
                  <div className="rounded-lg border border-ink-200 p-3 relative">
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
                      onChange={(e) => { setCollaboratorsInput(e.target.value); setShowCollabDropdown(true) }}
                      onFocus={() => setShowCollabDropdown(true)}
                      onBlur={() => setTimeout(() => setShowCollabDropdown(false), 150)}
                      placeholder="usuario1, usuario2"
                      className="w-full px-3 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
                    />
                    {showCollabDropdown && sugestoes.length > 0 && (
                      <div className="absolute z-10 left-3 right-3 mt-1 bg-white border border-ink-200 rounded-lg shadow-lg py-1 max-h-40 overflow-y-auto">
                        {sugestoes.map((u) => (
                          <button key={u} type="button" onMouseDown={() => pickCollaborator(u)} className="w-full text-left px-3 py-1.5 text-sm text-ink-700 hover:bg-ink-50">
                            @{u}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-ink-400">
                      Até 3 @usuários, separados por vírgula. Eles precisam aceitar o convite pra aparecer como autores.
                      {collabSuggestions !== null && ' Sugestões vêm de quem já comentou ou te chamou no direct — o Instagram não permite buscar qualquer usuário.'}
                    </p>
                  </div>
                )
              })()}

              {enabledBlocks.has('ai') && (
                <div className="rounded-lg border border-ink-200 p-3 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isAiGenerated} onChange={(e) => setIsAiGenerated(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                    <span className="flex items-center gap-1.5 text-sm text-ink-700"><Sparkles className="w-3.5 h-3.5 text-ink-400" /> Conteúdo gerado por IA</span>
                  </label>
                  <button type="button" onClick={() => removeBlock('ai')} className="text-ink-400 hover:text-red-600" aria-label="Remover selo de IA"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {enabledBlocks.has('hashtags') && (
                <div className="rounded-lg border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><Hash className="w-3.5 h-3.5 text-ink-400" /> Hashtags salvas</label>
                    <button type="button" onClick={() => removeBlock('hashtags')} className="text-ink-400 hover:text-red-600" aria-label="Remover hashtags"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  {conjuntosHashtags === null && <p className="text-xs text-ink-400">Carregando...</p>}
                  {conjuntosHashtags?.length === 0 && <p className="text-xs text-ink-400">Nenhum conjunto salvo ainda — crie um abaixo.</p>}
                  {conjuntosHashtags && conjuntosHashtags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {conjuntosHashtags.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => inserirHashtags(h.hashtags)}
                          className="px-2.5 py-1 rounded-full bg-ink-100 hover:bg-brand-100 hover:text-brand-700 text-xs text-ink-700 transition-colors"
                          title={h.hashtags}
                        >
                          {h.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pt-2 border-t border-ink-100">
                    <input
                      type="text"
                      value={novoHashtagNome}
                      onChange={(e) => setNovoHashtagNome(e.target.value)}
                      placeholder="Nome"
                      className="w-24 px-2 py-1 border border-ink-200 rounded text-xs"
                    />
                    <input
                      type="text"
                      value={novoHashtagTexto}
                      onChange={(e) => setNovoHashtagTexto(e.target.value)}
                      placeholder="#tag1 #tag2 #tag3"
                      className="flex-1 px-2 py-1 border border-ink-200 rounded text-xs"
                    />
                    <button type="button" onClick={handleCriarConjuntoHashtags} className="px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700 shrink-0">
                      Salvar
                    </button>
                  </div>
                </div>
              )}

              {enabledBlocks.has('captionTemplate') && (
                <div className="rounded-lg border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><FileText className="w-3.5 h-3.5 text-ink-400" /> Modelo de legenda</label>
                    <button type="button" onClick={() => removeBlock('captionTemplate')} className="text-ink-400 hover:text-red-600" aria-label="Remover modelo de legenda"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  {modelosLegenda === null && <p className="text-xs text-ink-400">Carregando...</p>}
                  {modelosLegenda?.length === 0 && <p className="text-xs text-ink-400">Nenhum modelo salvo ainda — crie um abaixo.</p>}
                  {modelosLegenda && modelosLegenda.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {modelosLegenda.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => aplicarModeloLegenda(m)}
                          className="px-2.5 py-1 rounded-full bg-ink-100 hover:bg-brand-100 hover:text-brand-700 text-xs text-ink-700 transition-colors"
                          title={[m.gancho, m.corpo, m.cta].filter(Boolean).join(' · ')}
                        >
                          {m.nome}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-1.5 pt-2 border-t border-ink-100">
                    <input type="text" value={novoModeloNome} onChange={(e) => setNovoModeloNome(e.target.value)} placeholder="Nome do modelo" className="w-full px-2 py-1 border border-ink-200 rounded text-xs" />
                    <input type="text" value={novoModeloGancho} onChange={(e) => setNovoModeloGancho(e.target.value)} placeholder="Gancho (primeira frase)" className="w-full px-2 py-1 border border-ink-200 rounded text-xs" />
                    <input type="text" value={novoModeloCorpo} onChange={(e) => setNovoModeloCorpo(e.target.value)} placeholder="Corpo" className="w-full px-2 py-1 border border-ink-200 rounded text-xs" />
                    <div className="flex items-center gap-1.5">
                      <input type="text" value={novoModeloCta} onChange={(e) => setNovoModeloCta(e.target.value)} placeholder="Chamada pra ação" className="flex-1 px-2 py-1 border border-ink-200 rounded text-xs" />
                      <button type="button" onClick={handleCriarModeloLegenda} className="px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700 shrink-0">Salvar</button>
                    </div>
                  </div>
                </div>
              )}

              {enabledBlocks.has('watermark') && (
                <div className="rounded-lg border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><Droplet className="w-3.5 h-3.5 text-ink-400" /> Marca d’água</label>
                    <button type="button" onClick={() => removeBlock('watermark')} className="text-ink-400 hover:text-red-600" aria-label="Remover marca d’água"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  {publishConfig.marcaDaguaUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element -- preview do logo já hospedado, não passa pelo otimizador do Next */}
                      <img src={publishConfig.marcaDaguaUrl} alt="" className="w-10 h-10 object-contain rounded border border-ink-200 bg-white shrink-0" />
                      <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                        <input type="checkbox" checked={applyWatermark} onChange={(e) => setApplyWatermark(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                        Aplicar nesta publicação (canto inferior direito)
                      </label>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-2 border border-dashed border-ink-300 rounded-lg cursor-pointer hover:bg-ink-50 text-xs text-ink-600">
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin text-ink-400" /> : <UploadCloud className="w-4 h-4 text-ink-400" />}
                      {uploadingLogo ? 'Enviando...' : 'Enviar logo da empresa'}
                      <input type="file" accept="image/jpeg,image/png" className="hidden" disabled={uploadingLogo} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUploadLogo(f) }} />
                    </label>
                  )}
                </div>
              )}

              {enabledBlocks.has('signature') && (
                <div className="rounded-lg border border-ink-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-1.5 text-sm text-ink-700"><PenLine className="w-3.5 h-3.5 text-ink-400" /> Assinatura</label>
                    <button type="button" onClick={() => removeBlock('signature')} className="text-ink-400 hover:text-red-600" aria-label="Remover assinatura"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea
                    value={assinaturaInput}
                    onChange={(e) => setAssinaturaInput(e.target.value)}
                    rows={2}
                    placeholder="Ex: 📍 São Paulo | zybot.com.br"
                    className="w-full px-2.5 py-1.5 border border-ink-200 rounded text-xs"
                  />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                      <input type="checkbox" checked={assinaturaAutoInput} onChange={(e) => setAssinaturaAutoInput(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                      Incluir automaticamente em novos posts
                    </label>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setCaption((prev) => (prev ? `${prev}\n\n${assinaturaInput}` : assinaturaInput))} className="text-xs text-ink-600 hover:text-brand-700">Inserir agora</button>
                      <button type="button" onClick={handleSalvarAssinatura} className="px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700">Salvar padrão</button>
                    </div>
                  </div>
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
                          min={nowLocalForInput()}
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
