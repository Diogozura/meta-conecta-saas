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
  Palette,
  Search,
  Clock,
  History,
} from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import CropEditor, { CropThumb, exportCroppedFile, DEFAULT_CROP, type CropSettings } from './CropEditor'
import VideoTrimEditor, { exportTrimmedFile, DEFAULT_TRIM, type VideoTrimSettings } from './VideoTrimEditor'
import { encontrarHashtagsArriscadas } from '@/lib/hashtagsArriscadas'
import { encontrarTermosProibidos, encontrarRiscosPolitica } from '@/lib/textoRiscos'
import { nowParaInput, dataParaInput, inputParaData } from '@/lib/fusoHorario'
import { encontrarConflito } from '@/lib/agendaConflito'
import { proximaOcorrencia } from '@/lib/horarioFixo'

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
  guiaDeMarca?: { cores?: string[]; fontes?: string[]; tomDeVoz?: string }
  termosProibidos?: string[]
  fusoHorario?: string
  numeroAvisoWhatsapp?: string
  confirmacaoManualAtiva?: boolean
}

interface HorarioFixo {
  id: string
  label: string
  diaSemana: number
  horario: string
}

const DIAS_SEMANA_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

// Fusos comuns no Brasil — não é uma lista exaustiva de todos os fusos do mundo, só o suficiente
// pra quem agenda de um lugar diferente do fuso "principal" da conta escolher o certo sem digitar
// um nome IANA de cabeça. "Automático" (sem valor) mantém o comportamento de sempre (fuso do navegador).
const FUSOS_HORARIOS_OPTIONS = [
  { value: '', label: 'Automático (fuso do navegador)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (UTC-2)' },
  { value: 'America/Sao_Paulo', label: 'Brasília (UTC-3)' },
  { value: 'America/Manaus', label: 'Manaus (UTC-4)' },
  { value: 'America/Rio_Branco', label: 'Acre (UTC-5)' },
]

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
  status: 'rascunho' | 'agendado' | 'aguardando_confirmacao' | 'enviando' | 'processando' | 'publicado' | 'falhou'
  agendadoPara?: string
  erro?: string
  dataCriacao: string
  qstashMessageId?: string | null
  qstashErro?: string | null
  direitosAutoraisConfirmado?: boolean
  pausado?: boolean
}

interface PublishItem {
  file: File
  crop: CropSettings
  trim: VideoTrimSettings
}

const STATUS_LABEL: Record<Publicacao['status'], string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  aguardando_confirmacao: 'Aguardando confirmação',
  enviando: 'Enviando',
  processando: 'Processando',
  publicado: 'Publicado',
  falhou: 'Falhou',
}

const STATUS_CLASS: Record<Publicacao['status'], string> = {
  rascunho: 'bg-ink-100 text-ink-500',
  agendado: 'bg-blue-100 text-blue-700',
  aguardando_confirmacao: 'bg-purple-100 text-purple-700',
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
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
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
  const publicacoesAgendadasParaConflito = useMemo(
    () => publicacoes.filter((p): p is Publicacao & { agendadoPara: string } => (p.status === 'agendado' || p.status === 'aguardando_confirmacao') && !!p.agendadoPara),
    [publicacoes],
  )
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [agendarAberto, setAgendarAberto] = useState(false)
  const [agendadoParaInput, setAgendadoParaInput] = useState('')
  const [savingSchedule, setSavingSchedule] = useState<'rascunho' | 'agendado' | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCaption, setEditCaption] = useState('')
  const [editAgendadoPara, setEditAgendadoPara] = useState('')
  const [editDireitosConfirmados, setEditDireitosConfirmados] = useState(false)
  const [versoesAberto, setVersoesAberto] = useState(false)
  const [versoes, setVersoes] = useState<{ id: string; caption?: string; altText?: string; collaborators?: string[]; criadoEm: string }[] | null>(null)
  const [loadingVersoes, setLoadingVersoes] = useState(false)
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
  const [canvaModalAberto, setCanvaModalAberto] = useState(false)
  const [canvaConectado, setCanvaConectado] = useState<boolean | null>(null)
  const [canvaDesigns, setCanvaDesigns] = useState<{ id: string; title?: string; thumbnail?: { url?: string } }[]>([])
  const [canvaQuery, setCanvaQuery] = useState('')
  const [canvaContinuation, setCanvaContinuation] = useState<string | undefined>(undefined)
  const [canvaLoadingDesigns, setCanvaLoadingDesigns] = useState(false)
  const [canvaExportingId, setCanvaExportingId] = useState<string | null>(null)
  const [direitosAutoraisConfirmado, setDireitosAutoraisConfirmado] = useState(false)
  const [guiaDeMarcaAberto, setGuiaDeMarcaAberto] = useState(false)
  const [editandoGuiaDeMarca, setEditandoGuiaDeMarca] = useState(false)
  const [coresInput, setCoresInput] = useState('')
  const [fontesInput, setFontesInput] = useState('')
  const [tomDeVozInput, setTomDeVozInput] = useState('')
  const [termosProibidosInput, setTermosProibidosInput] = useState('')
  const [savingGuiaDeMarca, setSavingGuiaDeMarca] = useState(false)
  const [loteDireitosConfirmados, setLoteDireitosConfirmados] = useState(false)
  const [configAgendamentoAberto, setConfigAgendamentoAberto] = useState(false)
  const [fusoHorarioInput, setFusoHorarioInput] = useState('')
  const [numeroAvisoWhatsappInput, setNumeroAvisoWhatsappInput] = useState('')
  const [confirmacaoManualInput, setConfirmacaoManualInput] = useState(false)
  const [savingConfigAgendamento, setSavingConfigAgendamento] = useState(false)
  const [horariosFixos, setHorariosFixos] = useState<HorarioFixo[] | null>(null)
  const [horarioFixoSelecionado, setHorarioFixoSelecionado] = useState('')
  const [novoHorarioLabel, setNovoHorarioLabel] = useState('')
  const [novoHorarioDia, setNovoHorarioDia] = useState(2)
  const [novoHorarioHora, setNovoHorarioHora] = useState('18:00')
  const [gerenciarHorariosAberto, setGerenciarHorariosAberto] = useState(false)

  const activeType = TYPE_OPTIONS.find((t) => t.key === tipo)!
  const isCarousel = tipo === 'CAROUSEL'
  // Toda imagem tem corte/filtro/texto (CropEditor) e todo vídeo tem recorte de início/fim/mudo
  // (VideoTrimEditor) — o passo de edição aparece sempre que tiver pelo menos 1 item.
  const hasCropStep = items.length > 0
  const itemsValid = isCarousel ? items.length >= MIN_CAROUSEL_ITEMS && items.length <= MAX_CAROUSEL_ITEMS : items.length === 1

  const previews = useMemo(() => items.map((it) => ({ file: it.file, url: URL.createObjectURL(it.file) })), [items])
  useEffect(() => () => { previews.forEach((p) => URL.revokeObjectURL(p.url)) }, [previews])

  const coverPreview = useMemo(() => (coverFile ? URL.createObjectURL(coverFile) : null), [coverFile])
  useEffect(() => () => { if (coverPreview) URL.revokeObjectURL(coverPreview) }, [coverPreview])

  const collaboratorsCount = collaboratorsInput.split(',').map((u) => u.trim()).filter(Boolean).length
  const hashtagCount = useMemo(() => (caption.match(/#[\p{L}0-9_]+/gu) ?? []).length, [caption])
  const mentionCount = useMemo(() => (caption.match(/@[\p{L}0-9_.]+/gu) ?? []).length, [caption])
  const hashtagsArriscadas = useMemo(() => encontrarHashtagsArriscadas(caption), [caption])
  const termosProibidosEncontrados = useMemo(() => encontrarTermosProibidos(caption, publishConfig.termosProibidos), [caption, publishConfig.termosProibidos])
  const riscosPolitica = useMemo(() => encontrarRiscosPolitica(caption), [caption])

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
        setCoresInput((config.guiaDeMarca?.cores ?? []).join(', '))
        setFontesInput((config.guiaDeMarca?.fontes ?? []).join(', '))
        setTomDeVozInput(config.guiaDeMarca?.tomDeVoz ?? '')
        setTermosProibidosInput((config.termosProibidos ?? []).join(', '))
        setFusoHorarioInput(config.fusoHorario ?? '')
        setNumeroAvisoWhatsappInput(config.numeroAvisoWhatsapp ?? '')
        setConfirmacaoManualInput(!!config.confirmacaoManualAtiva)
        if (config.assinaturaAtiva && config.assinatura) {
          setCaption((prev) => (prev ? prev : config.assinatura!))
        }
      })
      .catch(() => {})
    fetch('/api/instagram/horarios-fixos')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { horarios: HorarioFixo[] } | null) => setHorariosFixos(data?.horarios ?? []))
      .catch(() => setHorariosFixos([]))
  }, [connected])

  async function handleSalvarConfigAgendamento() {
    setSavingConfigAgendamento(true)
    try {
      const res = await fetch('/api/conta/instagram-publish-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fusoHorario: fusoHorarioInput,
          numeroAvisoWhatsapp: numeroAvisoWhatsappInput.trim(),
          confirmacaoManualAtiva: confirmacaoManualInput,
        }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setPublishConfig((prev) => ({
        ...prev,
        fusoHorario: fusoHorarioInput || undefined,
        numeroAvisoWhatsapp: numeroAvisoWhatsappInput.trim() || undefined,
        confirmacaoManualAtiva: confirmacaoManualInput,
      }))
      toast.success('Configurações de agendamento salvas.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configurações')
    } finally {
      setSavingConfigAgendamento(false)
    }
  }

  async function handleCriarHorarioFixo() {
    if (!novoHorarioLabel.trim()) return
    try {
      const res = await fetch('/api/instagram/horarios-fixos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: novoHorarioLabel.trim(), diaSemana: novoHorarioDia, horario: novoHorarioHora }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setHorariosFixos((prev) => [...(prev ?? []), json.horario])
      setNovoHorarioLabel('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar horário fixo')
    }
  }

  async function handleExcluirHorarioFixo(id: string) {
    setHorariosFixos((prev) => (prev ?? []).filter((h) => h.id !== id))
    await fetch(`/api/instagram/horarios-fixos/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function usarHorarioFixo(id: string) {
    setHorarioFixoSelecionado(id)
    const horario = horariosFixos?.find((h) => h.id === id)
    if (!horario) return
    const proxima = proximaOcorrencia(horario.diaSemana, horario.horario, new Date(), publishConfig.fusoHorario)
    setAgendadoParaInput(dataParaInput(proxima, publishConfig.fusoHorario))
  }

  async function handleSalvarGuiaDeMarca() {
    setSavingGuiaDeMarca(true)
    try {
      const guiaDeMarca = {
        cores: coresInput.split(',').map((c) => c.trim()).filter(Boolean),
        fontes: fontesInput.split(',').map((f) => f.trim()).filter(Boolean),
        tomDeVoz: tomDeVozInput.trim(),
      }
      const termosProibidos = termosProibidosInput.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await fetch('/api/conta/instagram-publish-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guiaDeMarca, termosProibidos }),
      })
      if (!res.ok) throw new Error('Erro ao salvar guia de marca')
      setPublishConfig((prev) => ({ ...prev, guiaDeMarca, termosProibidos }))
      setEditandoGuiaDeMarca(false)
      toast.success('Guia de marca salvo.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar guia de marca')
    } finally {
      setSavingGuiaDeMarca(false)
    }
  }

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
    const incoming = Array.from(list).map((file) => ({ file, crop: { ...DEFAULT_CROP, aspect: aspectoPadrao }, trim: { ...DEFAULT_TRIM } }))
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

  function updateTrim(index: number, trim: VideoTrimSettings) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, trim } : it)))
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
    setDireitosAutoraisConfirmado(false)
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

  async function aplicarModeloLegenda(m: ModeloLegenda) {
    const texto = [m.gancho, m.corpo, m.cta].filter(Boolean).join('\n\n')
    if (caption.trim() && !(await confirm('Substituir a legenda atual pelo modelo escolhido?', { danger: false }))) return
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
      setActiveCropIndex(0)
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
      items.map((it) => (isImageFile(it.file) ? exportCroppedFile(it.file, it.crop, marcaDagua) : exportTrimmedFile(it.file, it.trim))),
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
    if (direitosAutoraisConfirmado) formData.append('direitosAutoraisConfirmado', 'true')
    return formData
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault()
    if (step !== 'share') return
    if (!itemsValid) {
      toast.error(isCarousel ? `Carrossel precisa de ${MIN_CAROUSEL_ITEMS} a ${MAX_CAROUSEL_ITEMS} itens.` : 'Selecione ao menos um arquivo.')
      return
    }
    if (!direitosAutoraisConfirmado) {
      toast.error('Confirme que você tem os direitos de uso dessa mídia antes de publicar.')
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
    if (mode === 'agendado' && !direitosAutoraisConfirmado) {
      toast.error('Confirme que você tem os direitos de uso dessa mídia antes de agendar.')
      return
    }
    const dataAgendada = mode === 'agendado' ? inputParaData(agendadoParaInput, publishConfig.fusoHorario) : null
    if (dataAgendada) {
      const conflito = encontrarConflito(dataAgendada, publicacoesAgendadasParaConflito)
      if (conflito && !(await confirm(`Já tem outra publicação agendada bem perto desse horário (${formatAgendadoPara(String(conflito.agendadoPara))}). Agendar mesmo assim?`, { confirmLabel: 'Agendar mesmo assim', danger: false }))) {
        return
      }
    }

    setSavingSchedule(mode)
    try {
      const formData = await buildFormData()
      if (dataAgendada) formData.append('agendadoPara', dataAgendada.toISOString())

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
    if (!loteDireitosConfirmados) {
      toast.error('Confirme que você tem os direitos de uso dessas imagens antes de agendar.')
      return
    }
    setLoteSaving(true)
    try {
      const formData = new FormData()
      loteFiles.forEach((f) => formData.append('files', f))
      if (loteCaption.trim()) formData.append('caption', loteCaption.trim())
      formData.append('primeiraData', inputParaData(lotePrimeiraData, publishConfig.fusoHorario).toISOString())
      formData.append('intervaloDias', String(loteIntervalo))
      formData.append('direitosAutoraisConfirmado', 'true')

      const res = await fetch('/api/instagram/publish/schedule/batch', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao importar')

      toast.success(`${json.criadas.length} publicações agendadas!`)
      setLoteAberto(false)
      setLoteFiles([])
      setLoteCaption('')
      setLotePrimeiraData('')
      setLoteDireitosConfirmados(false)
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar em lote')
    } finally {
      setLoteSaving(false)
    }
  }

  async function carregarCanvaDesigns(query?: string, continuation?: string) {
    setCanvaLoadingDesigns(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('query', query)
      if (continuation) params.set('continuation', continuation)
      const res = await fetch(`/api/canva/designs?${params.toString()}`)
      const json = await res.json()
      if (json.naoConectado) {
        setCanvaConectado(false)
        return
      }
      if (!res.ok) throw new Error(json.error ?? 'Erro ao listar designs do Canva')
      setCanvaConectado(true)
      setCanvaDesigns((prev) => (continuation ? [...prev, ...(json.items ?? [])] : (json.items ?? [])))
      setCanvaContinuation(json.continuation)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao listar designs do Canva')
    } finally {
      setCanvaLoadingDesigns(false)
    }
  }

  function abrirCanvaModal() {
    setCanvaModalAberto(true)
    if (canvaConectado === null) carregarCanvaDesigns()
  }

  async function importarDesignCanva(designId: string) {
    setCanvaExportingId(designId)
    try {
      const tipoExport = tipo === 'REELS' || tipo === 'VIDEO' ? 'video' : 'image'
      const res = await fetch('/api/canva/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId, tipo: tipoExport }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao exportar do Canva')

      let arquivo: File | null = null
      for (let tentativa = 0; tentativa < 20 && !arquivo; tentativa++) {
        await new Promise((r) => setTimeout(r, 1500))
        const statusRes = await fetch(`/api/canva/export/${json.jobId}`)
        if (statusRes.headers.get('X-Export-Status') === 'success') {
          const blob = await statusRes.blob()
          const ext = tipoExport === 'video' ? 'mp4' : 'jpg'
          arquivo = new File([blob], `canva-${designId}.${ext}`, { type: blob.type })
          break
        }
        const statusJson = await statusRes.json().catch(() => ({}))
        if (statusJson.status === 'failed') throw new Error(statusJson.error ?? 'Exportação falhou no Canva')
      }
      if (!arquivo) throw new Error('A exportação demorou demais — tente de novo.')

      addFiles([arquivo])
      setCanvaModalAberto(false)
      toast.success('Design importado do Canva!')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao importar do Canva')
    } finally {
      setCanvaExportingId(null)
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
    setEditAgendadoPara(p.agendadoPara ? dataParaInput(p.agendadoPara, publishConfig.fusoHorario) : '')
    // Só reabre a exigência de confirmação se essa publicação nunca teve os direitos confirmados
    // antes (ex: um rascunho salvo sem agendar) — reagendar algo que já foi confirmado na criação
    // não precisa marcar de novo.
    setEditDireitosConfirmados(!!p.direitosAutoraisConfirmado)
    setVersoesAberto(false)
    setVersoes(null)
  }

  async function handleVerVersoes(id: string) {
    setVersoesAberto((v) => !v)
    if (versoes !== null) return
    setLoadingVersoes(true)
    try {
      const res = await fetch(`/api/instagram/publications/${id}/versoes`)
      const json = await res.json()
      setVersoes(json.versoes ?? [])
    } catch {
      setVersoes([])
    } finally {
      setLoadingVersoes(false)
    }
  }

  function handleRestaurarVersao(v: { caption?: string }) {
    setEditCaption(v.caption ?? '')
    toast('Versão restaurada no campo de legenda — clique em Salvar pra confirmar.')
  }

  async function handleSaveEdit(id: string, opts?: { publicarAgora?: boolean }) {
    if (!opts?.publicarAgora && editAgendadoPara && !editDireitosConfirmados) {
      toast.error('Confirme que você tem os direitos de uso dessa mídia antes de agendar.')
      return
    }
    const novaData = !opts?.publicarAgora && editAgendadoPara ? inputParaData(editAgendadoPara, publishConfig.fusoHorario) : null
    if (novaData) {
      const conflito = encontrarConflito(novaData, publicacoesAgendadasParaConflito, { ignorarId: id })
      if (conflito && !(await confirm(`Já tem outra publicação agendada bem perto desse horário (${formatAgendadoPara(String(conflito.agendadoPara))}). Reagendar mesmo assim?`, { confirmLabel: 'Reagendar mesmo assim', danger: false }))) {
        return
      }
    }
    setSavingEdit(true)
    try {
      const body: Record<string, unknown> = opts?.publicarAgora
        ? { publicarAgora: true }
        : {
          caption: editCaption,
          agendadoPara: novaData ? novaData.toISOString() : null,
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

  async function handleForceNow(p: Publicacao) {
    if (!p.direitosAutoraisConfirmado) {
      const ok = await confirm('Confirme que você tem os direitos de uso dessa mídia (imagem, vídeo e áudio) antes de publicar.', {
        confirmLabel: 'Confirmar e publicar',
        danger: false,
      })
      if (!ok) return
    }
    const id = p.id
    setForcingId(id)
    try {
      const res = await fetch(`/api/instagram/publications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicarAgora: true, direitosAutoraisConfirmado: true }),
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

  async function handleConfirmarPublicacao(id: string) {
    setForcingId(id)
    try {
      const res = await fetch(`/api/instagram/publications/${id}/confirmar`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao confirmar')
      toast.success('Confirmado — publicando...')
      await loadHistory()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao confirmar')
    } finally {
      setForcingId(null)
    }
  }

  async function handleDeleteHistoryItem(id: string, status: Publicacao['status']) {
    const mensagem = status === 'rascunho' || status === 'agendado'
      ? 'Cancelar essa publicação? O arquivo enviado será descartado.'
      : 'Remover esta publicação do histórico do painel? O post publicado no Instagram não é afetado.'
    if (!(await confirm(mensagem, { confirmLabel: status === 'rascunho' || status === 'agendado' ? 'Cancelar publicação' : 'Remover' }))) return
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
                min={nowParaInput(publishConfig.fusoHorario)}
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
                  const d = new Date(inputParaData(lotePrimeiraData, publishConfig.fusoHorario).getTime() + i * loteIntervalo * 86400000)
                  return <li key={i}>Post {i + 1} → {d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</li>
                })}
              </ul>
            )}

            <label className="flex items-start gap-2 text-xs text-ink-600">
              <input
                type="checkbox"
                checked={loteDireitosConfirmados}
                onChange={(e) => setLoteDireitosConfirmados(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-brand-600"
              />
              Confirmo que tenho os direitos de uso dessas imagens.
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLoteAberto(false)} className="px-3 py-2 text-sm text-ink-600 hover:text-ink-900">Cancelar</button>
              <button
                type="button"
                onClick={handleImportarLote}
                disabled={loteSaving || !loteDireitosConfirmados}
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

              {items.length === 0 && (
                <button
                  type="button"
                  onClick={abrirCanvaModal}
                  className="mt-2 flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-brand-700"
                >
                  <Palette className="w-3.5 h-3.5" /> Importar do Canva
                </button>
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
                      onClick={() => setActiveCropIndex(i)}
                      className={`relative shrink-0 rounded-md overflow-hidden border-2 ${activeCropIndex === i ? 'border-brand-600' : 'border-transparent'}`}
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
              {items[activeCropIndex] && (
                isImageFile(items[activeCropIndex].file) ? (
                  <CropEditor
                    url={previews[activeCropIndex].url}
                    settings={items[activeCropIndex].crop}
                    onChange={(next) => updateCrop(activeCropIndex, next)}
                  />
                ) : (
                  <VideoTrimEditor
                    url={previews[activeCropIndex].url}
                    settings={items[activeCropIndex].trim}
                    onChange={(next) => updateTrim(activeCropIndex, next)}
                  />
                )
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
                  disabled={publishing || !!savingSchedule || !direitosAutoraisConfirmado}
                  className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {publishing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {publishing ? 'Publicando...' : 'Publicar agora'}
                </button>
              </div>
            </div>

            <label className="flex items-start gap-2 text-xs text-ink-600 bg-ink-50 rounded-lg px-3 py-2">
              <input
                type="checkbox"
                checked={direitosAutoraisConfirmado}
                onChange={(e) => setDireitosAutoraisConfirmado(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-brand-600 shrink-0"
              />
              Confirmo que tenho os direitos de uso desta mídia (imagem, vídeo e áudio) e que ela não viola direitos autorais de terceiros. Necessário pra agendar ou publicar (não pra salvar rascunho).
            </label>

            {agendarAberto && (
              <div className="space-y-2 rounded-lg border border-ink-200 p-3">
                {!!horariosFixos?.length && (
                  <select
                    value={horarioFixoSelecionado}
                    onChange={(e) => usarHorarioFixo(e.target.value)}
                    className="w-full px-3 py-1.5 border border-ink-300 rounded-lg text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                  >
                    <option value="">Usar um horário fixo salvo...</option>
                    {horariosFixos.map((h) => (
                      <option key={h.id} value={h.id}>{h.label} ({DIAS_SEMANA_LABEL[h.diaSemana]} às {h.horario})</option>
                    ))}
                  </select>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={agendadoParaInput}
                    onChange={(e) => setAgendadoParaInput(e.target.value)}
                    min={nowParaInput(publishConfig.fusoHorario)}
                    className="flex-1 px-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => handleSaveDraftOrSchedule('agendado')}
                    disabled={savingSchedule === 'agendado' || !direitosAutoraisConfirmado}
                    className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 shrink-0"
                  >
                    {savingSchedule === 'agendado' ? 'Agendando...' : 'Confirmar'}
                  </button>
                </div>
                <button type="button" onClick={() => setGerenciarHorariosAberto((v) => !v)} className="text-[11px] text-ink-500 hover:text-brand-700">
                  {gerenciarHorariosAberto ? 'Fechar' : 'Gerenciar horários fixos'}
                </button>
                {gerenciarHorariosAberto && (
                  <div className="space-y-2 border-t border-ink-100 pt-2">
                    {horariosFixos?.map((h) => (
                      <div key={h.id} className="flex items-center justify-between text-xs text-ink-600">
                        <span>{h.label} — {DIAS_SEMANA_LABEL[h.diaSemana]} às {h.horario}</span>
                        <button type="button" onClick={() => handleExcluirHorarioFixo(h.id)} className="text-ink-400 hover:text-red-600" aria-label="Excluir horário fixo">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5">
                      <input
                        value={novoHorarioLabel}
                        onChange={(e) => setNovoHorarioLabel(e.target.value)}
                        placeholder="Nome (ex: Post de terça)"
                        className="flex-1 px-2 py-1 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                      />
                      <select
                        value={novoHorarioDia}
                        onChange={(e) => setNovoHorarioDia(Number(e.target.value))}
                        className="px-2 py-1 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                      >
                        {DIAS_SEMANA_LABEL.map((label, i) => <option key={i} value={i}>{label}</option>)}
                      </select>
                      <input
                        type="time"
                        value={novoHorarioHora}
                        onChange={(e) => setNovoHorarioHora(e.target.value)}
                        className="px-2 py-1 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                      />
                      <button type="button" onClick={handleCriarHorarioFixo} className="px-2 py-1 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700 shrink-0">
                        Salvar
                      </button>
                    </div>
                  </div>
                )}
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
                {termosProibidosEncontrados.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-red-700 bg-red-50 rounded-md px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Termo proibido pela conta: {termosProibidosEncontrados.join(', ')}</span>
                  </p>
                )}
                {riscosPolitica.length > 0 && (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-md px-2.5 py-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>Possível violação das políticas do Instagram: {riscosPolitica.join('; ')}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-lg border border-ink-200">
              <button
                type="button"
                onClick={() => setGuiaDeMarcaAberto((v) => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-600 hover:text-brand-700"
              >
                <Palette className="w-3.5 h-3.5" /> Guia de marca
              </button>
              {guiaDeMarcaAberto && (
                <div className="px-3 pb-3 space-y-2">
                  {editandoGuiaDeMarca ? (
                    <>
                      <div>
                        <label className="text-[11px] text-ink-500">Cores (separadas por vírgula, ex: #123456, #abcdef)</label>
                        <input
                          value={coresInput}
                          onChange={(e) => setCoresInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-500">Fontes (separadas por vírgula)</label>
                        <input
                          value={fontesInput}
                          onChange={(e) => setFontesInput(e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-500">Tom de voz</label>
                        <textarea
                          value={tomDeVozInput}
                          onChange={(e) => setTomDeVozInput(e.target.value)}
                          rows={2}
                          placeholder="Ex: direto, descontraído, sem gírias, sempre na 2ª pessoa..."
                          className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-ink-500">Termos proibidos na legenda (separados por vírgula)</label>
                        <input
                          value={termosProibidosInput}
                          onChange={(e) => setTermosProibidosInput(e.target.value)}
                          placeholder="Ex: nome do concorrente, gíria fora do tom da marca..."
                          className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setEditandoGuiaDeMarca(false)} className="text-xs text-ink-500 hover:text-ink-800">Cancelar</button>
                        <button
                          type="button"
                          onClick={handleSalvarGuiaDeMarca}
                          disabled={savingGuiaDeMarca}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                        >
                          {savingGuiaDeMarca ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      {(publishConfig.guiaDeMarca?.cores?.length || publishConfig.guiaDeMarca?.fontes?.length || publishConfig.guiaDeMarca?.tomDeVoz || publishConfig.termosProibidos?.length) ? (
                        <div className="space-y-1.5 text-xs text-ink-600">
                          {!!publishConfig.guiaDeMarca?.cores?.length && (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-ink-400">Cores:</span>
                              {publishConfig.guiaDeMarca.cores.map((c) => (
                                <span key={c} className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-ink-200">
                                  <span className="w-3 h-3 rounded-full border border-ink-200" style={{ backgroundColor: c }} />
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          {!!publishConfig.guiaDeMarca?.fontes?.length && (
                            <p><span className="text-ink-400">Fontes:</span> {publishConfig.guiaDeMarca.fontes.join(', ')}</p>
                          )}
                          {!!publishConfig.guiaDeMarca?.tomDeVoz && (
                            <p><span className="text-ink-400">Tom de voz:</span> {publishConfig.guiaDeMarca.tomDeVoz}</p>
                          )}
                          {!!publishConfig.termosProibidos?.length && (
                            <p><span className="text-ink-400">Termos proibidos:</span> {publishConfig.termosProibidos.join(', ')}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-ink-400">Nenhum guia de marca configurado ainda.</p>
                      )}
                      <button type="button" onClick={() => setEditandoGuiaDeMarca(true)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                        {(publishConfig.guiaDeMarca?.cores?.length || publishConfig.guiaDeMarca?.fontes?.length || publishConfig.guiaDeMarca?.tomDeVoz || publishConfig.termosProibidos?.length) ? 'Editar' : 'Configurar'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-ink-200">
              <button
                type="button"
                onClick={() => setConfigAgendamentoAberto((v) => !v)}
                className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-ink-600 hover:text-brand-700"
              >
                <Clock className="w-3.5 h-3.5" /> Configurações de agendamento
              </button>
              {configAgendamentoAberto && (
                <div className="px-3 pb-3 space-y-2">
                  <div>
                    <label className="text-[11px] text-ink-500">Fuso horário pra interpretar as datas de agendamento</label>
                    <select
                      value={fusoHorarioInput}
                      onChange={(e) => setFusoHorarioInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                    >
                      {FUSOS_HORARIOS_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-ink-500">WhatsApp pra avisar ~1h antes de cada post sair (opcional)</label>
                    <input
                      value={numeroAvisoWhatsappInput}
                      onChange={(e) => setNumeroAvisoWhatsappInput(e.target.value)}
                      placeholder="Ex: 5511999999999"
                      className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                    />
                    <p className="text-[10px] text-ink-400 mt-0.5">Só funciona se esse número tiver falado com o seu WhatsApp nas últimas 24h (regra da própria Meta pra mensagem iniciada pela empresa).</p>
                  </div>
                  <label className="flex items-start gap-2 text-xs text-ink-600">
                    <input
                      type="checkbox"
                      checked={confirmacaoManualInput}
                      onChange={(e) => setConfirmacaoManualInput(e.target.checked)}
                      className="w-4 h-4 mt-0.5 accent-brand-600"
                    />
                    Exigir confirmação manual antes de publicar (a hora chega, mas o post só sai depois de eu confirmar no painel)
                  </label>
                  <button
                    type="button"
                    onClick={handleSalvarConfigAgendamento}
                    disabled={savingConfigAgendamento}
                    className="px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                  >
                    {savingConfigAgendamento ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              )}
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

      {canvaModalAberto && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setCanvaModalAberto(false)}>
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-ink-800 flex items-center gap-1.5"><Palette className="w-4 h-4" /> Importar do Canva</h4>
              <button type="button" onClick={() => setCanvaModalAberto(false)} className="text-ink-400 hover:text-ink-700" aria-label="Fechar"><X className="w-4 h-4" /></button>
            </div>

            {canvaConectado === false && (
              <div className="py-8 text-center space-y-3">
                <p className="text-sm text-ink-500">Sua conta do Canva ainda não está conectada.</p>
                <a href="/api/canva/authorize" className="inline-block px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700">Conectar Canva</a>
              </div>
            )}

            {canvaConectado === true && (
              <>
                <div className="relative mb-3">
                  <Search className="w-3.5 h-3.5 text-ink-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={canvaQuery}
                    onChange={(e) => setCanvaQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') carregarCanvaDesigns(canvaQuery) }}
                    placeholder="Buscar design..."
                    className="w-full pl-8 pr-3 py-2 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                  />
                </div>
                <div className="flex-1 overflow-y-auto grid grid-cols-3 gap-2">
                  {canvaDesigns.map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => importarDesignCanva(d.id)}
                      disabled={!!canvaExportingId}
                      className="relative aspect-square rounded-lg overflow-hidden border border-ink-200 hover:border-brand-400 disabled:opacity-50"
                      title={d.title}
                    >
                      {d.thumbnail?.url && (
                        // eslint-disable-next-line @next/next/no-img-element -- miniatura vinda da CDN do Canva
                        <img src={d.thumbnail.url} alt={d.title ?? ''} className="w-full h-full object-cover" />
                      )}
                      {canvaExportingId === d.id && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {canvaLoadingDesigns && <p className="text-center text-xs text-ink-400 py-3">Carregando...</p>}
                {!canvaLoadingDesigns && canvaDesigns.length === 0 && <p className="text-center text-xs text-ink-400 py-8">Nenhum design encontrado.</p>}
                {!canvaLoadingDesigns && canvaContinuation && (
                  <button type="button" onClick={() => carregarCanvaDesigns(canvaQuery, canvaContinuation)} className="mt-2 text-xs text-brand-600 hover:text-brand-700 self-center">
                    Carregar mais
                  </button>
                )}
              </>
            )}

            {canvaConectado === null && <p className="text-center text-xs text-ink-400 py-8">Carregando...</p>}
          </div>
        </div>
      )}

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
              const editavel = p.status === 'rascunho' || p.status === 'agendado' || p.status === 'aguardando_confirmacao'
              return (
                <div key={p.id} className="p-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 ${STATUS_CLASS[p.status]}`}>
                      {STATUS_LABEL[p.status]}
                    </span>
                    {p.pausado && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-1 rounded shrink-0 bg-ink-200 text-ink-600">Pausado</span>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-900 truncate">{p.caption || '(sem legenda)'}</p>
                      <p className="text-xs text-ink-500">
                        {p.tipo}{p.tipo === 'CAROUSEL' && p.itemCount ? ` · ${p.itemCount} itens` : ''}
                        {(p.status === 'agendado' || p.status === 'aguardando_confirmacao') && p.agendadoPara ? ` · agendado pra ${formatAgendadoPara(p.agendadoPara)}` : ` · ${new Date(p.dataCriacao).toLocaleString('pt-BR')}`}
                      </p>
                      {p.status === 'agendado' && (
                        p.qstashMessageId ? (
                          <p className="text-[10px] text-brand-600" title={p.qstashMessageId}>⏱ Disparo exato agendado (QStash)</p>
                        ) : p.qstashErro ? (
                          <p className="text-[10px] text-red-600" title={p.qstashErro}>⚠ Sem disparo exato — vai depender só do cron de 5 min ({p.qstashErro.slice(0, 60)})</p>
                        ) : null
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button type="button" onClick={() => handleDuplicate(p)} className="p-1.5 text-ink-400 hover:text-brand-600" aria-label="Duplicar" title="Duplicar (legenda e configurações, escolha o arquivo de novo)">
                        <Copy className="w-4 h-4" />
                      </button>
                      {p.status === 'aguardando_confirmacao' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmarPublicacao(p.id)}
                          disabled={forcingId === p.id}
                          className="p-1.5 text-purple-600 hover:text-purple-800 disabled:opacity-50"
                          aria-label="Confirmar e publicar"
                          title="Confirmar e publicar agora"
                        >
                          {forcingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                      )}
                      {editavel && (
                        <>
                          <button type="button" onClick={() => handleStartEdit(p)} className="p-1.5 text-ink-400 hover:text-brand-600" aria-label="Editar" title="Editar legenda/agendamento">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {p.status !== 'aguardando_confirmacao' && (
                            <button
                              type="button"
                              onClick={() => handleForceNow(p)}
                              disabled={forcingId === p.id}
                              className="p-1.5 text-ink-400 hover:text-brand-600 disabled:opacity-50"
                              aria-label="Publicar agora"
                              title="Publicar agora"
                            >
                              {forcingId === p.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </button>
                          )}
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
                          min={nowParaInput(publishConfig.fusoHorario)}
                          className="flex-1 px-3 py-1.5 border border-ink-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                        />
                        <button type="button" onClick={() => setEditingId(null)} className="text-xs text-ink-500 hover:text-ink-700">Cancelar</button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(p.id)}
                          disabled={savingEdit || (!!editAgendadoPara && !editDireitosConfirmados)}
                          className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
                        >
                          {savingEdit ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                      <p className="text-[11px] text-ink-400">Deixe a data em branco pra virar rascunho (sem agendamento).</p>
                      {editAgendadoPara && !editDireitosConfirmados && (
                        <label className="flex items-start gap-2 text-xs text-ink-600">
                          <input
                            type="checkbox"
                            checked={editDireitosConfirmados}
                            onChange={(e) => setEditDireitosConfirmados(e.target.checked)}
                            className="w-4 h-4 mt-0.5 accent-brand-600"
                          />
                          Confirmo que tenho os direitos de uso dessa mídia.
                        </label>
                      )}
                      <button type="button" onClick={() => handleVerVersoes(p.id)} className="flex items-center gap-1 text-[11px] text-ink-500 hover:text-brand-700">
                        <History className="w-3 h-3" /> {versoesAberto ? 'Ocultar histórico de versões' : 'Ver histórico de versões'}
                      </button>
                      {versoesAberto && (
                        loadingVersoes ? (
                          <p className="text-[11px] text-ink-400">Carregando...</p>
                        ) : !versoes || versoes.length === 0 ? (
                          <p className="text-[11px] text-ink-400">Nenhuma edição anterior registrada.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-32 overflow-y-auto">
                            {versoes.map((v) => (
                              <div key={v.id} className="flex items-start justify-between gap-2 bg-ink-50 rounded-md px-2 py-1.5">
                                <div className="min-w-0">
                                  <p className="text-[11px] text-ink-600 truncate">{v.caption || '(sem legenda)'}</p>
                                  <p className="text-[10px] text-ink-400">{new Date(v.criadoEm).toLocaleString('pt-BR')}</p>
                                </div>
                                <button type="button" onClick={() => handleRestaurarVersao(v)} className="text-[11px] text-brand-600 hover:text-brand-700 font-medium shrink-0">
                                  Restaurar
                                </button>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {ConfirmDialogElement}
    </div>
  )
}
