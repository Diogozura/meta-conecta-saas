'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { MessageSquare, Search, Send, Loader2, AlertCircle, Plus, X, UserCheck, Bot, ArrowLeft, Clock, CheckCircle2, RotateCcw, Workflow, BarChart3, Users as UsersIcon, Zap, Trash2, Download, History, Paperclip, MoreVertical, ShieldOff } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import {
  type ConversaStatus,
  type ConversaMeta,
  type Prioridade,
  STATUS_LABELS,
  PRIORIDADE_LABELS,
  CONVERSA_META_PADRAO,
  filaDaConversa,
  formatEspera,
  esperaExcedeuSla,
  ordenarFilaPorPrioridade,
  slaParaPrioridade,
  SLA_ALERTA_MINUTOS,
} from '@/lib/conversaStatus'
import type { MetricaSetor, MetricaHistoricaSetor, MetricaCsat } from '@/lib/metricasConversas'

type Message = {
  id: string
  text: string
  direction: 'sent' | 'received'
  time: string
  // Preenchido quando a Meta rejeitou o envio (ex: janela de 24h expirada) —
  // deixa claro pro atendente que aquela mensagem NÃO chegou no WhatsApp.
  failReason?: string
  mediaId?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document' | 'sticker'
  mediaFilename?: string
}

// Código que a Graph API retorna quando a janela de 24h de atendimento já
// expirou (ou nunca existiu) e a conversa só pode ser reaberta com um
// template aprovado.
const META_REENGAGEMENT_ERROR_CODE = 131047

function friendlySendError(code?: number): string {
  if (code === META_REENGAGEMENT_ERROR_CODE) {
    return 'Mensagem não enviada — envie um template aprovado para reiniciar essa conversa.'
  }
  return 'Mensagem não enviada. Tente novamente.'
}

type Conversation = {
  name: string
  number: string
  last: string
  time: string
  // Unix seconds da última mensagem (enviada ou recebida) — usado só pra
  // ordenar a lista da mais recente pra mais antiga. Conversas antigas
  // salvas no localStorage antes desse campo existir ficam com 0 (vão pro
  // fim da lista até receberem mensagem nova).
  lastTimestamp: number
  status: 'Recebida' | 'Enviada'
  messages: Message[]
}

const STORAGE_KEY = 'meta-conversas'

type HistoryMessage = {
  id: string
  from: string
  to?: string
  nomeContato?: string
  text: string
  timestamp: number // unix seconds
  tipo: 'recebida' | 'enviada'
  mediaId?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document' | 'sticker'
  mediaFilename?: string
}

function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveToStorage(convs: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convs))
  } catch {}
}

function formatTime(unixSeconds: number) {
  return new Date(unixSeconds * 1000).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

// Data + hora da última mensagem, exibida na lista de conversas — só a hora
// (formato antigo) não deixava claro se a conversa era de hoje ou de dias
// atrás.
function formatListTimestamp(unixSeconds: number) {
  const date = new Date(unixSeconds * 1000)
  const datePart = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const timePart = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${datePart} ${timePart}`
}

function nowUnix() {
  return Math.floor(Date.now() / 1000)
}

// Mantém a lista sempre ordenada da conversa mais recente pra mais antiga,
// com base no timestamp real da última mensagem — não na ordem de chegada.
function sortConvs(list: Conversation[]): Conversation[] {
  return [...list].sort((a, b) => (b.lastTimestamp ?? 0) - (a.lastTimestamp ?? 0))
}

/**
 * Reconstrói as conversas a partir do histórico persistido no Firestore
 * (/api/messages/history) — o localStorage sozinho não sobrevive a outro
 * navegador/dispositivo, e o polling em memória (/api/messages) é perdido a
 * cada reinício do servidor. Preserva o `name` já digitado localmente pro
 * número (localStorage não guarda nome no Firestore hoje).
 */
function buildConversationsFromHistory(mensagens: HistoryMessage[], existingNames: Map<string, string>): Conversation[] {
  const byNumber = new Map<string, HistoryMessage[]>()
  for (const m of mensagens) {
    const rawNumber = m.tipo === 'recebida' ? m.from : (m.to || m.from)
    const number = (rawNumber ?? '').replace(/\D/g, '')
    if (!number) continue
    if (!byNumber.has(number)) byNumber.set(number, [])
    byNumber.get(number)!.push(m)
  }

  const conversations = Array.from(byNumber.entries()).map(([number, msgs]) => {
    const sorted = [...msgs].sort((a, b) => a.timestamp - b.timestamp)
    const messages: Message[] = sorted.map((m) => ({
      id: m.id,
      text: m.text,
      direction: m.tipo === 'recebida' ? 'received' : 'sent',
      time: formatTime(m.timestamp),
      mediaId: m.mediaId,
      mediaType: m.mediaType,
      mediaFilename: m.mediaFilename,
    }))
    const lastMsg = sorted[sorted.length - 1]
    // Nome que a pessoa cadastrou no próprio WhatsApp (vem no webhook) é a
    // fonte mais confiável — prioriza sobre nome digitado manualmente no
    // painel e sobre o número puro.
    const nomeWhatsapp = [...sorted].reverse().find((m) => m.nomeContato)?.nomeContato
    const conv: Conversation = {
      name: nomeWhatsapp || existingNames.get(number) || number,
      number,
      last: lastMsg.text,
      time: formatListTimestamp(lastMsg.timestamp),
      lastTimestamp: lastMsg.timestamp,
      status: lastMsg.tipo === 'recebida' ? 'Recebida' : 'Enviada',
      messages,
    }
    return conv
  })

  return sortConvs(conversations)
}

function ConversationRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-3 py-3">
      <Skeleton className="w-9 h-9 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

export default function ConversasPage() {
  return (
    <Suspense>
      <ConversasInner />
    </Suspense>
  )
}

function ConversasInner() {
  // Começa vazio (igual no servidor e no cliente, na primeira renderização)
  // e só lê o localStorage depois de montado — ler direto no useState
  // divergia entre servidor (sem localStorage) e cliente (com dados
  // salvos), causando erro de hydration.
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loadingConversas, setLoadingConversas] = useState(true)
  // Seleção por número (não por índice) — a lista é reordenada a cada
  // mensagem nova (item mais recente sobe pro topo), então um índice fixo
  // acabaria apontando pra conversa errada depois de um reorder.
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading'>('idle')
  const [enviandoMidia, setEnviandoMidia] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showLgpdMenu, setShowLgpdMenu] = useState(false)
  const [excluindoDadosLgpd, setExcluindoDadosLgpd] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setShowLgpdMenu(false)
  }, [selectedNumber])
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [showMetricas, setShowMetricas] = useState(false)
  const [abaMetricas, setAbaMetricas] = useState<'ao-vivo' | 'historico'>('ao-vivo')
  const [metricas, setMetricas] = useState<MetricaSetor[] | null>(null)
  const [metricasHistoricas, setMetricasHistoricas] = useState<MetricaHistoricaSetor[] | null>(null)
  const [csat, setCsat] = useState<MetricaCsat | null>(null)
  const [carregandoMetricas, setCarregandoMetricas] = useState(false)
  const [diasHistorico, setDiasHistorico] = useState(7)
  const [showAtendentes, setShowAtendentes] = useState(false)
  const [atendentes, setAtendentes] = useState<{ id: string; nome: string; email: string; setor: string | null; status?: string }[] | null>(null)
  const [carregandoAtendentes, setCarregandoAtendentes] = useState(false)
  const [showConvite, setShowConvite] = useState(false)
  const [convidando, setConvidando] = useState(false)
  const [conviteNome, setConviteNome] = useState('')
  const [conviteEmail, setConviteEmail] = useState('')
  const [showAuditoria, setShowAuditoria] = useState(false)
  const [auditoria, setAuditoria] = useState<{ id: string; descricao: string; usuarioNome: string; criadoEm: string }[] | null>(null)
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false)
  const [showRespostas, setShowRespostas] = useState(false)
  const [gerenciandoRespostas, setGerenciandoRespostas] = useState(false)
  const [respostasRapidas, setRespostasRapidas] = useState<{ id: string; atalho: string; texto: string }[] | null>(null)
  const [novaRespostaAtalho, setNovaRespostaAtalho] = useState('')
  const [novaRespostaTexto, setNovaRespostaTexto] = useState('')
  // Preferência pessoal do atendente (por navegador) — não é config da conta, cada um decide se assina.
  const [assinarMensagens, setAssinarMensagens] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setAssinarMensagens(localStorage.getItem('conversas-assinar-mensagens') === 'true')
  }, [])
  function alternarAssinatura() {
    setAssinarMensagens((prev) => {
      const next = !prev
      localStorage.setItem('conversas-assinar-mensagens', String(next))
      return next
    })
  }
  const [newNumber, setNewNumber] = useState('')
  const [newName, setNewName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setConversations(loadFromStorage())
  }, [])

  // Persiste conversas no localStorage sempre que mudarem
  useEffect(() => {
    saveToStorage(conversations)
  }, [conversations])

  // Carrega o histórico persistido no Firestore uma vez ao montar — sem
  // isso, trocar de navegador/dispositivo (ou limpar o localStorage) perdia
  // todo o histórico de conversas, mesmo as mensagens já estando salvas.
  useEffect(() => {
    let cancelled = false
    fetch('/api/messages/history')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { mensagens?: HistoryMessage[] } | null) => {
        if (cancelled || !data?.mensagens?.length) return
        setConversations((prev) => {
          const existingNames = new Map(prev.map((c) => [c.number, c.name]))
          const fromHistory = buildConversationsFromHistory(data.mensagens!, existingNames)
          // Conversas locais sem nenhuma mensagem ainda (recém-iniciadas) não
          // existem no histórico do Firestore — preserva essas.
          const historyNumbers = new Set(fromHistory.map((c) => c.number))
          const localOnly = prev.filter((c) => !historyNumbers.has(c.number) && c.messages.length === 0)
          return sortConvs([...fromHistory, ...localOnly])
        })
      })
      .catch(() => {
        // silencioso — mantém o que já tinha no localStorage/memória
      })
      .finally(() => {
        if (!cancelled) setLoadingConversas(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Abre conversa ao navegar via toast (?from=NUMERO)
  useEffect(() => {
    const from = searchParams.get('from')
    if (!from) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setConversations((prev) => {
      const existing = prev.find((c) => c.number.replace(/\D/g, '') === from.replace(/\D/g, ''))
      if (existing) {
        setSelectedNumber(existing.number)
        return prev
      }
      // Cria conversa nova para o número caso não exista
      const ts = nowUnix()
      const newConv: Conversation = {
        name: from,
        number: from,
        last: '',
        time: formatListTimestamp(ts),
        lastTimestamp: ts,
        status: 'Recebida',
        messages: [],
      }
      setSelectedNumber(newConv.number)
      return sortConvs([newConv, ...prev])
    })
  }, [searchParams])

  // Status/fila/atendente de TODAS as conversas — sobreposto na lista
  // (indicador + filtro por fila) e no painel da conversa aberta. Ausente no
  // mapa = nunca teve nenhuma transferência/estado especial (trata como
  // CONVERSA_META_PADRAO: IA ativa, em andamento).
  const [conversasMeta, setConversasMeta] = useState<Map<string, ConversaMeta>>(new Map())
  const [filtroFila, setFiltroFila] = useState<'todas' | 'aguardando' | 'encerradas'>('todas')

  // "Relógio" pra recalcular "há X min" sem precisar de um novo fetch — só
  // dispara re-render, não busca dado nenhum.
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!showMetricas) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setCarregandoMetricas(true)
    const url = abaMetricas === 'ao-vivo' ? '/api/conversas/metricas' : `/api/conversas/metricas/historico?dias=${diasHistorico}`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { metricas: MetricaSetor[] | MetricaHistoricaSetor[]; csat?: MetricaCsat } | null) => {
        if (cancelled || !data) return
        if (abaMetricas === 'ao-vivo') setMetricas(data.metricas as MetricaSetor[])
        else {
          setMetricasHistoricas(data.metricas as MetricaHistoricaSetor[])
          setCsat(data.csat ?? null)
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar as métricas.')
      })
      .finally(() => {
        if (!cancelled) setCarregandoMetricas(false)
      })
    return () => {
      cancelled = true
    }
  }, [showMetricas, abaMetricas, diasHistorico])

  useEffect(() => {
    if (!showAtendentes) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setCarregandoAtendentes(true)
    fetch('/api/atendentes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { atendentes: { id: string; nome: string; email: string; setor?: string | null; status?: string }[] } | null) => {
        if (!cancelled && data) setAtendentes(data.atendentes.map((a) => ({ ...a, setor: a.setor ?? null })))
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar os atendentes.')
      })
      .finally(() => {
        if (!cancelled) setCarregandoAtendentes(false)
      })
    return () => {
      cancelled = true
    }
  }, [showAtendentes])

  useEffect(() => {
    if (!showAuditoria) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setCarregandoAuditoria(true)
    fetch('/api/auditoria')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { registros: { id: string; descricao: string; usuarioNome: string; criadoEm: string }[] } | null) => {
        if (!cancelled && data) setAuditoria(data.registros)
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar o log de auditoria.')
      })
      .finally(() => {
        if (!cancelled) setCarregandoAuditoria(false)
      })
    return () => {
      cancelled = true
    }
  }, [showAuditoria])

  useEffect(() => {
    if (!showRespostas || respostasRapidas !== null) return
    let cancelled = false
    fetch('/api/respostas-rapidas')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { respostas: { id: string; atalho: string; texto: string }[] } | null) => {
        if (!cancelled && data) setRespostasRapidas(data.respostas)
      })
      .catch(() => {
        if (!cancelled) toast.error('Erro ao carregar respostas rápidas.')
      })
    return () => {
      cancelled = true
    }
  }, [showRespostas, respostasRapidas])

  function inserirRespostaRapida(texto: string) {
    setMessage((prev) => (prev ? `${prev} ${texto}` : texto))
    setShowRespostas(false)
  }

  async function handleCriarRespostaRapida(e: React.FormEvent) {
    e.preventDefault()
    if (!novaRespostaAtalho.trim() || !novaRespostaTexto.trim()) return
    try {
      const res = await fetch('/api/respostas-rapidas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atalho: novaRespostaAtalho.trim(), texto: novaRespostaTexto.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar resposta rápida')
      setRespostasRapidas((prev) => [...(prev ?? []), json.resposta].sort((a, b) => a.atalho.localeCompare(b.atalho)))
      setNovaRespostaAtalho('')
      setNovaRespostaTexto('')
      toast.success('Resposta rápida criada.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar resposta rápida')
    }
  }

  async function handleExcluirRespostaRapida(id: string) {
    try {
      const res = await fetch(`/api/respostas-rapidas/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setRespostasRapidas((prev) => prev?.filter((r) => r.id !== id) ?? null)
    } catch {
      toast.error('Erro ao excluir resposta rápida')
    }
  }

  async function handleConvidarAtendente(e: React.FormEvent) {
    e.preventDefault()
    if (!conviteNome.trim() || !conviteEmail.trim()) return
    setConvidando(true)
    try {
      const res = await fetch('/api/atendentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: conviteNome.trim(), email: conviteEmail.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao convidar atendente')
      setAtendentes((prev) => [...(prev ?? []), { ...json.atendente, setor: json.atendente.setor ?? null }])
      setConviteNome('')
      setConviteEmail('')
      setShowConvite(false)
      toast.success(json.emailEnviado ? 'Convite enviado por e-mail.' : 'Atendente criado — configure RESEND_API_KEY pra enviar o e-mail automaticamente.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao convidar atendente')
    } finally {
      setConvidando(false)
    }
  }

  async function handleSalvarSetorAtendente(id: string, setor: string) {
    setAtendentes((prev) => prev?.map((a) => (a.id === id ? { ...a, setor: setor || null } : a)) ?? null)
    try {
      const res = await fetch(`/api/atendentes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setor }),
      })
      if (!res.ok) throw new Error()
      toast.success('Setor atualizado.')
    } catch {
      toast.error('Erro ao salvar o setor desse atendente.')
    }
  }

  const filtradoPorBusca = conversations.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.number.includes(search.replace(/\D/g, ''))
    if (!matchesSearch) return false
    if (filtroFila === 'todas') return true
    const meta = conversasMeta.get(c.number) ?? CONVERSA_META_PADRAO
    if (filtroFila === 'encerradas') return meta.status === 'encerrada'
    return filaDaConversa(meta) === 'aguardando'
  })

  // Na fila "aguardando" a ordem não é mais só "mais recente primeiro" — VIP/urgente fura a fila.
  const filtered =
    filtroFila === 'aguardando'
      ? ordenarFilaPorPrioridade(filtradoPorBusca.map((c) => ({ ...c, ...(conversasMeta.get(c.number) ?? CONVERSA_META_PADRAO) })))
      : filtradoPorBusca

  const totalAguardando = conversations.filter((c) => filaDaConversa(conversasMeta.get(c.number) ?? CONVERSA_META_PADRAO) === 'aguardando').length
  const totalSlaEstourado = conversations.filter((c) => {
    const meta = conversasMeta.get(c.number) ?? CONVERSA_META_PADRAO
    return filaDaConversa(meta) === 'aguardando' && meta.dataTransferencia && esperaExcedeuSla(new Date(meta.dataTransferencia), agora, slaParaPrioridade(meta.prioridade))
  }).length

  const currentConv = selectedNumber !== null ? conversations.find((c) => c.number === selectedNumber) ?? null : null

  // Scroll automático ao chegar nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConv?.messages.length])

  async function carregarConversasMeta() {
    try {
      const res = await fetch('/api/conversas')
      if (!res.ok) return
      const data = (await res.json()) as {
        conversas: {
          numero: string
          status?: ConversaStatus
          iaAtiva: boolean
          motivoTransferencia?: string | null
          dataTransferencia?: string | null
          atendenteId?: string | null
          atendenteNome?: string | null
          assumidoEm?: string | null
          setor?: string | null
          prioridade?: Prioridade
        }[]
      }
      setConversasMeta(
        new Map(
          data.conversas.map((c) => [
            c.numero,
            {
              status: c.status ?? 'em_andamento',
              iaAtiva: c.iaAtiva,
              motivoTransferencia: c.motivoTransferencia ?? null,
              dataTransferencia: c.dataTransferencia ?? null,
              atendenteId: c.atendenteId ?? null,
              atendenteNome: c.atendenteNome ?? null,
              assumidoEm: c.assumidoEm ?? null,
              setor: c.setor ?? null,
              prioridade: c.prioridade ?? 'normal',
            },
          ])
        )
      )
    } catch {
      // silencioso — mantém o que já tinha, tenta de novo no próximo ciclo
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    carregarConversasMeta()
    const id = setInterval(() => {
      if (document.hidden) return
      void carregarConversasMeta()
    }, 8000)
    return () => clearInterval(id)
  }, [])

  function atualizarMetaLocal(numero: string, patch: Partial<ConversaMeta>) {
    setConversasMeta((prev) => {
      const next = new Map(prev)
      next.set(numero, { ...CONVERSA_META_PADRAO, ...prev.get(numero), ...patch })
      return next
    })
  }

  const currentMeta = currentConv ? (conversasMeta.get(currentConv.number) ?? CONVERSA_META_PADRAO) : null

  async function handleToggleIA(novoEstado: boolean) {
    if (!currentConv) return
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/ia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iaAtiva: novoEstado }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar a IA')
      atualizarMetaLocal(currentConv.number, {
        iaAtiva: novoEstado,
        motivoTransferencia: novoEstado ? null : 'Desativada manualmente pelo painel',
        ...(novoEstado ? { atendenteId: null, atendenteNome: null, assumidoEm: null } : {}),
      })
    } catch {
      toast.error('Erro ao atualizar a IA dessa conversa.')
    }
  }

  async function handleAssumirConversa() {
    if (!currentConv) return
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/assumir`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao assumir a conversa')
      await carregarConversasMeta()
      toast.success('Você assumiu essa conversa.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao assumir a conversa')
    }
  }

  async function handleLiberarConversa() {
    if (!currentConv) return
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/liberar`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao liberar a conversa')
      atualizarMetaLocal(currentConv.number, { atendenteId: null, atendenteNome: null, assumidoEm: null })
      toast.success('Conversa liberada — volta pra fila de aguardando humano.')
    } catch {
      toast.error('Erro ao liberar a conversa')
    }
  }

  async function handleMudarStatusConversa(novoStatus: 'encerrada' | 'aberta') {
    if (!currentConv) return
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novoStatus }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar o status da conversa')
      atualizarMetaLocal(currentConv.number, { status: novoStatus })
      toast.success(novoStatus === 'encerrada' ? 'Conversa encerrada.' : 'Conversa reaberta.')
    } catch {
      toast.error('Erro ao atualizar o status da conversa')
    }
  }

  async function handleMudarPrioridade(novaPrioridade: Prioridade) {
    if (!currentConv) return
    const anterior = conversasMeta.get(currentConv.number)?.prioridade ?? 'normal'
    atualizarMetaLocal(currentConv.number, { prioridade: novaPrioridade })
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/prioridade`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prioridade: novaPrioridade }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar a prioridade')
    } catch {
      atualizarMetaLocal(currentConv.number, { prioridade: anterior })
      toast.error('Erro ao atualizar a prioridade')
    }
  }

  // Polling a cada 3s para receber mensagens do WhatsApp
  useEffect(() => {
    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const { messages, failures, serverTime } = await res.json() as {
          messages: {
            id: string
            from: string
            nomeContato?: string
            text: string
            timestamp: number
            mediaId?: string
            mediaType?: 'image' | 'audio' | 'video' | 'document' | 'sticker'
            mediaFilename?: string
          }[]
          failures: { id: string; erro?: { codigo?: number; mensagem: string } }[]
          serverTime: number
        }
        since = serverTime

        if (messages.length === 0 && failures.length === 0) return

        setConversations((prev) => {
          let next = [...prev]
          for (const data of messages) {
            const incomingMsg: Message = {
              id: data.id,
              text: data.text,
              direction: 'received',
              time: formatTime(data.timestamp),
              mediaId: data.mediaId,
              mediaType: data.mediaType,
              mediaFilename: data.mediaFilename,
            }
            const idx = next.findIndex(
              (c) => c.number.replace(/\D/g, '') === data.from.replace(/\D/g, '')
            )
            if (idx !== -1) {
              // Evita duplicata
              if (next[idx].messages.some((m) => m.id === data.id)) continue
              next = next.map((c, i) =>
                i === idx
                  ? {
                      ...c,
                      // Atualiza pro nome real do WhatsApp assim que ele chega
                      // (conversa pode ter sido criada só com o número antes disso).
                      name: data.nomeContato || c.name,
                      messages: [...c.messages, incomingMsg],
                      last: incomingMsg.text,
                      time: formatListTimestamp(data.timestamp),
                      lastTimestamp: data.timestamp,
                      status: 'Recebida' as const,
                    }
                  : c
              )
            } else {
              next = [
                {
                  name: data.nomeContato || data.from,
                  number: data.from,
                  last: incomingMsg.text,
                  time: formatListTimestamp(data.timestamp),
                  lastTimestamp: data.timestamp,
                  status: 'Recebida' as const,
                  messages: [incomingMsg],
                },
                ...next,
              ]
            }
          }

          // Mensagens que a Meta aceitou na hora (200 OK), mas rejeitou de
          // fato depois — reportado assíncrono, via webhook de status. Acha
          // a mensagem pelo ID real da Meta (trocado no lugar do ID
          // otimista assim que o envio respondeu com sucesso) e marca em
          // vermelho, senão o atendente nunca fica sabendo que não chegou.
          for (const fail of failures) {
            const failReason = friendlySendError(fail.erro?.codigo)
            next = next.map((c) => ({
              ...c,
              messages: c.messages.map((m) => (m.id === fail.id ? { ...m, failReason } : m)),
            }))
          }

          return sortConvs(next)
        })
      } catch {
        // silencioso — tenta no próximo ciclo
      }
    }

    // Pausa o polling quando a aba está em segundo plano — evita gastar
    // cota do Firestore com um chat que ninguém está olhando.
    const id = setInterval(() => {
      if (document.hidden) return
      void poll()
    }, 5000)
    return () => clearInterval(id)
  }, [])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || selectedNumber === null) return

    const conv = conversations.find((c) => c.number === selectedNumber)
    if (!conv) return
    const ts = nowUnix()
    const newMsg: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      direction: 'sent',
      time: formatTime(ts),
    }
    const msgText = message.trim()

    // Optimistic update
    setConversations((prev) =>
      sortConvs(
        prev.map((c) =>
          c.number === selectedNumber
            ? { ...c, messages: [...c.messages, newMsg], last: msgText, time: formatListTimestamp(ts), lastTimestamp: ts, status: 'Enviada' }
            : c
        )
      )
    )
    setMessage('')
    setSendStatus('loading')

    try {
      const res = await fetch('/api/meta/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: conv.number.replace(/\D/g, ''), message: msgText, assinar: assinarMensagens }),
      })
      const json: { error?: string; code?: number; messages?: { id: string }[] } = await res.json()
      if (!res.ok) {
        // A Meta recusou o envio na hora (ex: número nunca contatou o
        // negócio) — marca essa mensagem específica como não entregue em
        // vez de só mostrar um aviso genérico que some da tela.
        const failReason = friendlySendError(json.code)
        setConversations((prev) =>
          prev.map((c) =>
            c.number === selectedNumber
              ? { ...c, messages: c.messages.map((m) => (m.id === newMsg.id ? { ...m, failReason } : m)) }
              : c
          )
        )
      } else {
        // A Meta pode aceitar o envio na hora (200 OK) e só reportar uma
        // falha de verdade depois, de forma assíncrona (webhook de status —
        // ex: janela de 24h). Troca o ID otimista local pelo ID real da
        // Meta, senão o polling não consegue casar essa mensagem com o
        // aviso de falha quando ele chegar.
        const realId = json.messages?.[0]?.id
        if (realId && realId !== newMsg.id) {
          setConversations((prev) =>
            prev.map((c) =>
              c.number === selectedNumber
                ? { ...c, messages: c.messages.map((m) => (m.id === newMsg.id ? { ...m, id: realId } : m)) }
                : c
            )
          )
        }
        // Responder manualmente pausa a IA e assume a conversa pro atendente
        // (ver /api/meta/send-message) — busca o estado atualizado pra
        // refletir isso no painel sem esperar o próximo ciclo de 8s.
        void carregarConversasMeta()
      }
      setSendStatus('idle')
    } catch {
      const failReason = friendlySendError()
      setConversations((prev) =>
        prev.map((c) =>
          c.number === selectedNumber
            ? { ...c, messages: c.messages.map((m) => (m.id === newMsg.id ? { ...m, failReason } : m)) }
            : c
        )
      )
      setSendStatus('idle')
    }
  }

  async function handleEnviarMidia(file: File) {
    if (selectedNumber === null) return
    const conv = conversations.find((c) => c.number === selectedNumber)
    if (!conv) return

    setEnviandoMidia(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('to', conv.number.replace(/\D/g, ''))
      form.append('assinar', String(assinarMensagens))

      const res = await fetch('/api/meta/send-media', { method: 'POST', body: form })
      const json: { error?: string; code?: number; messages?: { id: string }[]; mediaId?: string; mediaType?: Message['mediaType'] } = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? friendlySendError(json.code))
        return
      }

      const ts = nowUnix()
      const newMsg: Message = {
        id: json.messages?.[0]?.id ?? Date.now().toString(),
        text: json.mediaType === 'document' ? file.name : '',
        direction: 'sent',
        time: formatTime(ts),
        mediaId: json.mediaId,
        mediaType: json.mediaType,
        mediaFilename: json.mediaType === 'document' ? file.name : undefined,
      }
      setConversations((prev) =>
        sortConvs(
          prev.map((c) =>
            c.number === selectedNumber
              ? { ...c, messages: [...c.messages, newMsg], last: newMsg.text || '📎 Arquivo', time: formatListTimestamp(ts), lastTimestamp: ts, status: 'Enviada' }
              : c
          )
        )
      )
      void carregarConversasMeta()
    } catch {
      toast.error('Erro ao enviar arquivo')
    } finally {
      setEnviandoMidia(false)
    }
  }

  async function handleExcluirDadosLgpd() {
    if (!currentConv) return
    const confirmado = window.confirm(
      `Isso apaga PERMANENTEMENTE todas as mensagens, o cadastro e as avaliações desse cliente (${currentConv.name} — ${currentConv.number}). Não tem como desfazer. Confirma?`
    )
    if (!confirmado) return

    setExcluindoDadosLgpd(true)
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/lgpd`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Erro ao excluir dados do cliente')
      }
      setConversations((prev) => prev.filter((c) => c.number !== currentConv.number))
      setSelectedNumber(null)
      setShowLgpdMenu(false)
      toast.success('Dados do cliente excluídos.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir dados do cliente')
    } finally {
      setExcluindoDadosLgpd(false)
    }
  }

  function handleStartNewConv(e: React.FormEvent) {
    e.preventDefault()
    if (!newNumber.trim()) return
    const name = newName.trim() || newNumber.trim()
    const ts = nowUnix()
    const newConv: Conversation = {
      name,
      number: newNumber.replace(/\D/g, ''),
      last: '',
      time: formatListTimestamp(ts),
      lastTimestamp: ts,
      status: 'Enviada',
      messages: [],
    }
    setConversations((prev) => sortConvs([newConv, ...prev]))
    setSelectedNumber(newConv.number)
    setShowNewForm(false)
    setNewNumber('')
    setNewName('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      <div className="flex gap-4 flex-1 min-h-0">
      {/* Left: conversation list — full width on mobile, hidden once a conversation is open */}
      <div
        data-tour="conversas-list"
        className={`w-full lg:w-72 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden shrink-0 ${
          selectedNumber !== null ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-3 border-b border-ink-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">Conversas</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowMetricas(true)}
                className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                title="Métricas da fila"
              >
                <BarChart3 className="w-4 h-4" />
              </button>
              <Link
                href="/dashboard/conversas/fluxo"
                className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                title="Fluxo de atendimento"
              >
                <Workflow className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowAtendentes(true)}
                className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                title="Setores dos atendentes (round-robin)"
              >
                <UsersIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowAuditoria(true)}
                className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                title="Log de auditoria (quem mudou o quê)"
              >
                <History className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowNewForm((v) => !v)}
                className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
                title="Nova conversa"
              >
                {showNewForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {showNewForm && (
            <form onSubmit={handleStartNewConv} className="space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome (opcional)"
                className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <input
                type="text"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="Número (Ex: 5511999990000)"
                required
                className="w-full px-3 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
              >
                Iniciar conversa
              </button>
            </form>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin">
            {(
              [
                { key: 'todas', label: 'Todas' },
                { key: 'aguardando', label: `Aguardando${totalAguardando > 0 ? ` (${totalAguardando})` : ''}` },
                { key: 'encerradas', label: 'Encerradas' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFiltroFila(tab.key)}
                title={tab.key === 'aguardando' && totalSlaEstourado > 0 ? `${totalSlaEstourado} aguardando há mais de ${SLA_ALERTA_MINUTOS} min` : undefined}
                className={`relative px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap transition-colors ${
                  filtroFila === tab.key ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                }`}
              >
                {tab.label}
                {tab.key === 'aguardando' && totalSlaEstourado > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white" />
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
          {loadingConversas && conversations.length === 0 && (
            <>
              {Array.from({ length: 5 }).map((_, i) => <ConversationRowSkeleton key={i} />)}
            </>
          )}
          {(!loadingConversas || conversations.length > 0) && filtered.map((c) => {
            const meta = conversasMeta.get(c.number) ?? CONVERSA_META_PADRAO
            const fila = filaDaConversa(meta)
            return (
              <div
                key={c.number}
                onClick={() => setSelectedNumber(c.number)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                  selectedNumber === c.number ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-ink-50'
                }`}
              >
                <div className="relative shrink-0">
                  <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-brand-700">{c.name[0]}</span>
                  </div>
                  {meta.status !== 'encerrada' && (() => {
                    const desde = fila === 'aguardando' && meta.dataTransferencia ? new Date(meta.dataTransferencia) : null
                    const estourouSla = desde ? esperaExcedeuSla(desde, agora, slaParaPrioridade(meta.prioridade)) : false
                    return (
                      <span
                        title={
                          fila === 'aguardando'
                            ? `Aguardando humano${meta.setor ? ` · ${meta.setor}` : ''}${desde ? ` · ${formatEspera(desde, agora)}` : ''}`
                            : fila === 'humano'
                              ? `Com ${meta.atendenteNome ?? 'atendente'}`
                              : 'IA respondendo'
                        }
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                          estourouSla ? 'bg-red-500' : fila === 'aguardando' ? 'bg-amber-500' : fila === 'humano' ? 'bg-blue-500' : 'bg-brand-500'
                        }`}
                      />
                    )
                  })()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="flex items-center gap-1 min-w-0">
                      {meta.prioridade !== 'normal' && (
                        <span
                          title={PRIORIDADE_LABELS[meta.prioridade]}
                          className={`shrink-0 text-[9px] font-bold uppercase px-1 py-0.5 rounded ${meta.prioridade === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}
                        >
                          {meta.prioridade === 'urgente' ? '!!' : '!'}
                        </span>
                      )}
                      <p className="text-xs font-semibold text-ink-900 truncate">{c.name}</p>
                    </span>
                    <span className="text-[10px] text-ink-400 shrink-0 ml-1">{c.time}</span>
                  </div>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">
                    {meta.status === 'encerrada' && <span className="text-ink-400">Encerrada · </span>}
                    {c.last || 'Sem mensagens'}
                  </p>
                </div>
              </div>
            )
          })}
          {!loadingConversas && filtered.length === 0 && (
            <div className="py-10 text-center text-ink-400 text-xs">Nenhuma conversa encontrada.</div>
          )}
        </div>
      </div>

      {/* Right: chat panel — hidden on mobile until a conversation is open */}
      <div className={`flex-1 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden ${currentConv ? 'flex' : 'hidden lg:flex'}`}>
        {currentConv ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-3 bg-ink-50">
              <button
                onClick={() => setSelectedNumber(null)}
                className="lg:hidden -ml-1 p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors shrink-0"
                aria-label="Voltar para a lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand-700">{currentConv.name[0]}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{currentConv.name}</p>
                <p className="text-xs text-ink-500 truncate">{currentConv.number}</p>
              </div>

              <div className="relative shrink-0">
                <button
                  onClick={() => setShowLgpdMenu((v) => !v)}
                  title="Dados do cliente (LGPD)"
                  className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showLgpdMenu && (
                  <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-ink-200 rounded-xl shadow-lg z-10 py-1 text-sm">
                    <a
                      href={`/api/conversas/${currentConv.number}/lgpd/exportar`}
                      onClick={() => setShowLgpdMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-ink-700 hover:bg-ink-50"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Exportar dados (LGPD)
                    </a>
                    <button
                      type="button"
                      onClick={handleExcluirDadosLgpd}
                      disabled={excluindoDadosLgpd}
                      className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {excluindoDadosLgpd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                      Excluir dados (LGPD)
                    </button>
                  </div>
                )}
              </div>

              {currentMeta && (
                <div className="ml-auto shrink-0 flex flex-wrap items-center justify-end gap-2 max-w-[55%]">
                  <span className="text-[10px] font-medium text-ink-500 bg-ink-100 px-2 py-1 rounded-full">
                    {STATUS_LABELS[currentMeta.status]}
                  </span>
                  <select
                    value={currentMeta.prioridade}
                    onChange={(e) => handleMudarPrioridade(e.target.value as Prioridade)}
                    title="Prioridade na fila"
                    className={`text-[10px] font-semibold px-2 py-1 rounded-full border-0 cursor-pointer ${
                      currentMeta.prioridade === 'urgente'
                        ? 'bg-red-100 text-red-700'
                        : currentMeta.prioridade === 'alta'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-ink-100 text-ink-500'
                    }`}
                  >
                    {(Object.keys(PRIORIDADE_LABELS) as Prioridade[]).map((p) => (
                      <option key={p} value={p}>
                        {PRIORIDADE_LABELS[p]}
                      </option>
                    ))}
                  </select>
                  <button
                    data-tour="conversas-ai-toggle"
                    onClick={() => handleToggleIA(!currentMeta.iaAtiva)}
                    title={currentMeta.iaAtiva ? 'Desativar a IA nessa conversa' : 'Reativar a IA nessa conversa'}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      currentMeta.iaAtiva
                        ? 'text-brand-700 bg-brand-100 hover:bg-brand-200'
                        : 'text-ink-600 bg-ink-200 hover:bg-ink-300'
                    }`}
                  >
                    <Bot className="w-3.5 h-3.5" />
                    {currentMeta.iaAtiva ? 'IA ativa' : 'IA desativada'}
                  </button>
                  {currentMeta.status === 'encerrada' ? (
                    <button
                      onClick={() => handleMudarStatusConversa('aberta')}
                      title="Reabrir conversa"
                      className="p-1.5 rounded-full text-ink-500 bg-white border border-ink-200 hover:bg-ink-50 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMudarStatusConversa('encerrada')}
                      title="Encerrar conversa"
                      className="p-1.5 rounded-full text-ink-500 bg-white border border-ink-200 hover:bg-ink-50 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {currentMeta?.status === 'encerrada' && (
              <div className="px-4 py-2.5 bg-ink-100 border-b border-ink-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-ink-600 min-w-0">
                  <Clock className="w-4 h-4 shrink-0" />
                  <span className="truncate">Essa conversa foi encerrada.</span>
                </div>
                <button
                  onClick={() => handleMudarStatusConversa('aberta')}
                  className="shrink-0 text-xs font-medium text-ink-700 bg-white border border-ink-200 hover:bg-ink-50 px-2.5 py-1 rounded-full transition-colors"
                >
                  Reabrir
                </button>
              </div>
            )}

            {currentMeta && currentMeta.status !== 'encerrada' && !currentMeta.iaAtiva && (
              currentMeta.atendenteId ? (
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-blue-800 min-w-0">
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span className="truncate">Em atendimento com {currentMeta.atendenteNome}</span>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <button
                      onClick={handleLiberarConversa}
                      className="text-xs font-medium text-blue-800 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors"
                    >
                      Liberar
                    </button>
                    <button
                      onClick={() => handleToggleIA(true)}
                      className="text-xs font-medium text-blue-800 bg-blue-100 hover:bg-blue-200 px-2.5 py-1 rounded-full transition-colors"
                    >
                      Reativar IA
                    </button>
                  </div>
                </div>
              ) : (
                (() => {
                  const desde = currentMeta.dataTransferencia ? new Date(currentMeta.dataTransferencia) : null
                  const estourouSla = desde ? esperaExcedeuSla(desde, agora, slaParaPrioridade(currentMeta.prioridade)) : false
                  return (
                    <div className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 ${estourouSla ? 'bg-red-50 border-red-100' : 'bg-amber-50 border-amber-100'}`}>
                      <div className={`flex items-center gap-2 text-xs min-w-0 ${estourouSla ? 'text-red-800' : 'text-amber-800'}`}>
                        <UserCheck className="w-4 h-4 shrink-0" />
                        <span className="truncate">
                          Aguardando atendimento humano{currentMeta.setor ? ` · ${currentMeta.setor}` : ''}
                          {desde ? ` · ${formatEspera(desde, agora)}` : ''}
                          {currentMeta.motivoTransferencia ? ` — ${currentMeta.motivoTransferencia}` : ''}
                        </span>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        <button
                          onClick={handleAssumirConversa}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${estourouSla ? 'text-red-800 bg-red-100 hover:bg-red-200' : 'text-amber-800 bg-amber-100 hover:bg-amber-200'}`}
                        >
                          Assumir atendimento
                        </button>
                        <button
                          onClick={() => handleToggleIA(true)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${estourouSla ? 'text-red-800 bg-red-100 hover:bg-red-200' : 'text-amber-800 bg-amber-100 hover:bg-amber-200'}`}
                        >
                          Reativar IA
                        </button>
                      </div>
                    </div>
                  )
                })()
              )
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50">
              {currentConv.messages.length === 0 && (
                <div className="text-center text-xs text-ink-400 py-8">Nenhuma mensagem ainda. Envie a primeira!</div>
              )}
              {currentConv.messages.map((msg) => {
                // Sem Firebase Storage: a mídia não fica guardada aqui, só o
                // ID — os bytes são buscados na hora, direto da Meta, por
                // esse proxy autenticado (ver api/whatsapp/midia/[mediaId]).
                const midiaSrc = msg.mediaId ? `/api/whatsapp/midia/${msg.mediaId}` : undefined
                return (
                <div key={msg.id} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      msg.failReason
                        ? 'bg-red-50 text-red-800 border border-red-200 rounded-br-sm'
                        : msg.direction === 'sent'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-white text-ink-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.mediaType === 'image' && midiaSrc && (
                      <a href={midiaSrc} target="_blank" rel="noopener noreferrer" className="block mb-1 -mx-1">
                        <img src={midiaSrc} alt={msg.text || 'Imagem'} className="max-w-full max-h-64 rounded-xl object-cover" />
                      </a>
                    )}
                    {msg.mediaType === 'video' && midiaSrc && (
                      <video src={midiaSrc} controls className="max-w-full max-h-64 rounded-xl mb-1" />
                    )}
                    {msg.mediaType === 'audio' && midiaSrc && (
                      <audio src={midiaSrc} controls className="mb-1 max-w-full" style={{ height: '32px' }} />
                    )}
                    {msg.mediaType === 'document' && midiaSrc && (
                      <a
                        href={midiaSrc}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex items-center gap-2 mb-1 px-2.5 py-2 rounded-lg text-xs font-medium ${
                          msg.direction === 'sent' ? 'bg-brand-700/40 text-white' : 'bg-ink-50 text-ink-700'
                        }`}
                      >
                        <Paperclip className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{msg.mediaFilename || 'Documento'}</span>
                      </a>
                    )}
                    {msg.mediaType === 'sticker' && midiaSrc && (
                      <img src={midiaSrc} alt="Figurinha" className="w-24 h-24 mb-1" />
                    )}
                    {msg.text && <p className="leading-snug">{msg.text}</p>}
                    {msg.failReason && (
                      <p className="flex items-center gap-1 text-[11px] mt-1 font-medium text-red-700">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        {msg.failReason}
                      </p>
                    )}
                    <p className={`text-[10px] mt-1 text-right ${msg.failReason ? 'text-red-400' : msg.direction === 'sent' ? 'text-brand-200' : 'text-ink-400'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input bar */}
            <div data-tour="conversas-input" className="border-t border-ink-100 bg-white">
              {showRespostas && (
                <div className="p-3 border-b border-ink-100 bg-ink-50 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-ink-700">Respostas rápidas</p>
                    <button type="button" onClick={() => setGerenciandoRespostas((v) => !v)} className="text-[11px] font-medium text-brand-700 hover:underline">
                      {gerenciandoRespostas ? 'Fechar' : 'Gerenciar'}
                    </button>
                  </div>

                  {gerenciandoRespostas && (
                    <form onSubmit={handleCriarRespostaRapida} className="flex flex-wrap items-end gap-1.5 mb-2 bg-white p-2 rounded-lg border border-ink-200">
                      <input
                        value={novaRespostaAtalho}
                        onChange={(e) => setNovaRespostaAtalho(e.target.value)}
                        placeholder="Atalho (ex: saudação)"
                        className="px-2 py-1 border border-ink-200 rounded text-xs w-28"
                      />
                      <input
                        value={novaRespostaTexto}
                        onChange={(e) => setNovaRespostaTexto(e.target.value)}
                        placeholder="Texto da resposta"
                        className="flex-1 min-w-[120px] px-2 py-1 border border-ink-200 rounded text-xs"
                      />
                      <button type="submit" className="px-2 py-1 bg-brand-600 text-white text-xs rounded hover:bg-brand-700">
                        Adicionar
                      </button>
                    </form>
                  )}

                  {respostasRapidas === null ? (
                    <p className="text-xs text-ink-400">Carregando...</p>
                  ) : respostasRapidas.length === 0 ? (
                    <p className="text-xs text-ink-400">Nenhuma resposta rápida cadastrada ainda.</p>
                  ) : (
                    <div className="space-y-1">
                      {respostasRapidas.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 bg-white border border-ink-200 rounded-lg px-2.5 py-1.5">
                          <button
                            type="button"
                            onClick={() => inserirRespostaRapida(r.texto)}
                            className="flex-1 min-w-0 text-left"
                          >
                            <span className="text-[11px] font-semibold text-brand-700">/{r.atalho}</span>{' '}
                            <span className="text-xs text-ink-600 truncate">{r.texto}</span>
                          </button>
                          {gerenciandoRespostas && (
                            <button type="button" onClick={() => handleExcluirRespostaRapida(r.id)} className="p-1 text-ink-400 hover:text-red-600 transition-colors shrink-0" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSend} className="flex items-end gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setShowRespostas((v) => !v)}
                  title="Respostas rápidas"
                  className={`p-2.5 rounded-full transition-colors shrink-0 ${showRespostas ? 'bg-brand-100 text-brand-700' : 'text-ink-400 hover:bg-ink-100'}`}
                >
                  <Zap className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={alternarAssinatura}
                  title={assinarMensagens ? 'Assinando com seu nome — clique pra desligar' : 'Assinar mensagens com seu nome'}
                  className={`p-2.5 rounded-full transition-colors shrink-0 ${assinarMensagens ? 'bg-brand-100 text-brand-700' : 'text-ink-400 hover:bg-ink-100'}`}
                >
                  <UserCheck className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/*,audio/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (file) void handleEnviarMidia(file)
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={enviandoMidia}
                  title="Anexar arquivo"
                  className="p-2.5 rounded-full text-ink-400 hover:bg-ink-100 transition-colors shrink-0 disabled:opacity-50"
                >
                  {enviandoMidia ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend(e as unknown as React.FormEvent)
                    }
                  }}
                  rows={1}
                  placeholder="Digite uma mensagem..."
                  className="flex-1 px-3 py-2 border border-ink-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  type="submit"
                  disabled={sendStatus === 'loading' || !message.trim()}
                  className="p-2.5 bg-brand-600 text-white rounded-full hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {sendStatus === 'loading'
                    ? <Loader2 className="w-5 h-5 animate-spin" />
                    : <Send className="w-5 h-5" />
                  }
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-ink-400 bg-ink-50">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs mt-1 opacity-70">ou clique em + para iniciar uma nova</p>
          </div>
        )}
      </div>
      </div>

      <Modal open={showMetricas} onClose={() => setShowMetricas(false)} title="Métricas da fila humana" widthClass="max-w-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              {(['ao-vivo', 'historico'] as const).map((aba) => (
                <button
                  key={aba}
                  onClick={() => setAbaMetricas(aba)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                    abaMetricas === aba ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                  }`}
                >
                  {aba === 'ao-vivo' ? 'Ao vivo' : 'Histórico'}
                </button>
              ))}
            </div>
            {abaMetricas === 'historico' && (
              <div className="flex items-center gap-1.5">
                <select
                  value={diasHistorico}
                  onChange={(e) => setDiasHistorico(Number(e.target.value))}
                  className="text-[11px] border border-ink-200 rounded-lg px-2 py-1"
                >
                  <option value={7}>Últimos 7 dias</option>
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
                <a
                  href={`/api/conversas/exportar?dias=${diasHistorico}`}
                  className="flex items-center gap-1 text-[11px] font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-1 rounded-lg transition-colors"
                  title="Exportar CSV desse período"
                >
                  <Download className="w-3 h-3" /> CSV
                </a>
              </div>
            )}
          </div>

          {carregandoMetricas ? (
            <div className="flex items-center justify-center py-8 text-ink-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : abaMetricas === 'ao-vivo' ? (
            !metricas || metricas.length === 0 ? (
              <p className="text-sm text-ink-400 text-center py-8">Nenhuma conversa na fila humana agora — tudo com a IA ou encerrado.</p>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] text-ink-400">
                  Fotografia de agora — não é histórico. Espera calculada só das conversas aguardando (ainda sem atendente).
                </p>
                <div className="border border-ink-200 rounded-xl divide-y divide-ink-100">
                  {metricas.map((m) => (
                    <div key={m.setor} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900 truncate">{m.setor}</p>
                        <p className="text-xs text-ink-500 mt-0.5">
                          {m.totalAguardando} aguardando · {m.totalEmAtendimento} em atendimento
                        </p>
                      </div>
                      {m.esperaMediaMin !== null && (
                        <div className="text-right shrink-0">
                          <p className={`text-xs font-semibold ${m.esperaMediaMin >= SLA_ALERTA_MINUTOS ? 'text-red-600' : 'text-ink-700'}`}>~{m.esperaMediaMin} min de espera</p>
                          <p className="text-[10px] text-ink-400">pico: {m.esperaMaximaMin} min</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (!metricasHistoricas || metricasHistoricas.length === 0) && !csat?.totalRespostas ? (
            <p className="text-sm text-ink-400 text-center py-8">Nenhum atendimento registrado nesse período.</p>
          ) : (
            <div className="space-y-3">
              {csat && csat.totalRespostas > 0 && (
                <div className="border border-ink-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">Satisfação (CSAT/NPS)</p>
                    <p className="text-xs text-ink-500 mt-0.5">{csat.totalRespostas} respostas · nota média {csat.notaMedia}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${csat.nps !== null && csat.nps >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {csat.nps !== null && csat.nps > 0 ? '+' : ''}{csat.nps}
                    </p>
                    <p className="text-[10px] text-ink-400">NPS</p>
                  </div>
                </div>
              )}
              {metricasHistoricas && metricasHistoricas.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] text-ink-400">Tempo real entre encaminhar → assumir (espera) e assumir → encerrar (atendimento).</p>
                  <div className="border border-ink-200 rounded-xl divide-y divide-ink-100">
                    {metricasHistoricas.map((m) => (
                      <div key={m.setor} className="px-4 py-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-ink-900 truncate">{m.setor}</p>
                          <p className="text-xs text-ink-500 shrink-0">{m.totalTransferencias} recebidas · {m.totalAssumidas} assumidas · {m.totalEncerradas} encerradas</p>
                        </div>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-ink-600">Espera média: <span className="font-semibold">{m.esperaMediaMin !== null ? `${m.esperaMediaMin} min` : '—'}</span></p>
                          <p className="text-xs text-ink-600">Atendimento médio: <span className="font-semibold">{m.atendimentoMedioMin !== null ? `${m.atendimentoMedioMin} min` : '—'}</span></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showAtendentes} onClose={() => setShowAtendentes(false)} title="Atendentes" widthClass="max-w-lg">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-400 flex-1">
              Mesmo setor = rodízio automático quando o fluxo encaminha pra esse setor. Em branco = só assume manualmente.
            </p>
            <button
              type="button"
              onClick={() => setShowConvite((v) => !v)}
              className="shrink-0 ml-2 flex items-center gap-1 text-xs font-medium text-brand-700 bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Convidar
            </button>
          </div>

          {showConvite && (
            <form onSubmit={handleConvidarAtendente} className="flex flex-wrap items-end gap-1.5 bg-ink-50 p-2.5 rounded-lg border border-ink-200">
              <input
                value={conviteNome}
                onChange={(e) => setConviteNome(e.target.value)}
                placeholder="Nome"
                required
                className="flex-1 min-w-[100px] px-2 py-1.5 border border-ink-200 rounded-lg text-xs"
              />
              <input
                type="email"
                value={conviteEmail}
                onChange={(e) => setConviteEmail(e.target.value)}
                placeholder="E-mail (conta Google)"
                required
                className="flex-1 min-w-[140px] px-2 py-1.5 border border-ink-200 rounded-lg text-xs"
              />
              <button type="submit" disabled={convidando} className="px-2.5 py-1.5 bg-brand-600 text-white text-xs rounded-lg hover:bg-brand-700 disabled:opacity-50">
                {convidando ? 'Enviando...' : 'Convidar'}
              </button>
              <p className="text-[10px] text-ink-400 basis-full">
                O convidado acessa entrando com Google em /login usando esse e-mail — sem senha pra configurar.
              </p>
            </form>
          )}

          {carregandoAtendentes ? (
            <div className="flex items-center justify-center py-8 text-ink-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : !atendentes || atendentes.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-8">Nenhum atendente encontrado.</p>
          ) : (
            <div className="border border-ink-200 rounded-xl divide-y divide-ink-100">
              {atendentes.map((a) => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink-900 truncate">{a.nome}</p>
                      {a.status === 'convite_pendente' && (
                        <span className="shrink-0 text-[9px] font-semibold uppercase text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full">Convite pendente</span>
                      )}
                    </div>
                    <p className="text-xs text-ink-500 truncate">{a.email}</p>
                  </div>
                  <input
                    defaultValue={a.setor ?? ''}
                    onBlur={(e) => {
                      if (e.target.value !== (a.setor ?? '')) handleSalvarSetorAtendente(a.id, e.target.value.trim())
                    }}
                    placeholder="Sem setor"
                    className="w-32 shrink-0 px-2.5 py-1.5 border border-ink-200 rounded-lg text-xs"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showAuditoria} onClose={() => setShowAuditoria(false)} title="Log de auditoria" widthClass="max-w-lg">
        <div className="space-y-3">
          <p className="text-[11px] text-ink-400">Mudanças em fluxo de atendimento, respostas rápidas e equipe — mais recente primeiro.</p>
          {carregandoAuditoria ? (
            <div className="flex items-center justify-center py-8 text-ink-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
            </div>
          ) : !auditoria || auditoria.length === 0 ? (
            <p className="text-sm text-ink-400 text-center py-8">Nenhuma mudança registrada ainda.</p>
          ) : (
            <div className="border border-ink-200 rounded-xl divide-y divide-ink-100 max-h-96 overflow-y-auto">
              {auditoria.map((r) => (
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
      </Modal>
    </div>
  )
}
