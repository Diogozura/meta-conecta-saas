'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MessageSquare, Search, Send, Loader2, AlertCircle, Plus, X, UserCheck, Bot, ArrowLeft } from 'lucide-react'
import { WhatsAppGlyph, InstagramGlyph, FacebookGlyph } from '@/components/BrandIcons'
import { Skeleton } from '@/components/Skeleton'

type Message = {
  id: string
  text: string
  direction: 'sent' | 'received'
  time: string
}

type Conversation = {
  name: string
  number: string
  last: string
  time: string
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
      time: formatTime(lastMsg.timestamp),
      status: lastMsg.tipo === 'recebida' ? 'Recebida' : 'Enviada',
      messages,
    }
    return { conv, lastTimestamp: lastMsg.timestamp }
  })

  return conversations.sort((a, b) => b.lastTimestamp - a.lastTimestamp).map((c) => c.conv)
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
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [sendError, setSendError] = useState('')
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
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
          return [...fromHistory, ...localOnly]
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
      const idx = prev.findIndex((c) => c.number.replace(/\D/g, '') === from.replace(/\D/g, ''))
      if (idx !== -1) {
        setSelectedIdx(idx)
        return prev
      }
      // Cria conversa nova para o número caso não exista
      const newConv: Conversation = {
        name: from,
        number: from,
        last: '',
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        status: 'Recebida',
        messages: [],
      }
      setSelectedIdx(0)
      return [newConv, ...prev]
    })
  }, [searchParams])

  const filtered = conversations.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.number.includes(search.replace(/\D/g, ''))
  )

  const currentConv = selectedIdx !== null ? conversations[selectedIdx] : null

  // Scroll automático ao chegar nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentConv?.messages.length])

  // Estado da IA na conversa selecionada — se um humano assumiu (ou a
  // própria IA transferiu), mostra o aviso e a opção de reativar.
  const [iaStatus, setIaStatus] = useState<{ iaAtiva: boolean; motivoTransferencia: string | null } | null>(null)

  useEffect(() => {
    if (!currentConv) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
      setIaStatus(null)
      return
    }
    let cancelled = false
    fetch(`/api/conversas/${currentConv.number}/ia`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setIaStatus(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só precisa reagir à troca de conversa, não a todo objeto novo
  }, [currentConv?.number])

  async function handleToggleIA(novoEstado: boolean) {
    if (!currentConv) return
    try {
      const res = await fetch(`/api/conversas/${currentConv.number}/ia`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ iaAtiva: novoEstado }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar a IA')
      setIaStatus({ iaAtiva: novoEstado, motivoTransferencia: novoEstado ? null : 'Desativada manualmente pelo painel' })
    } catch {
      // silencioso — o usuário pode tentar de novo
    }
  }

  // Polling a cada 3s para receber mensagens do WhatsApp
  useEffect(() => {
    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const { messages, serverTime } = await res.json() as {
          messages: { id: string; from: string; nomeContato?: string; text: string; timestamp: number }[]
          serverTime: number
        }
        since = serverTime

        if (messages.length === 0) return

        setConversations((prev) => {
          let next = [...prev]
          for (const data of messages) {
            const incomingTime = new Date(data.timestamp * 1000)
              .toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            const incomingMsg: Message = {
              id: data.id,
              text: data.text,
              direction: 'received',
              time: incomingTime,
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
                      time: incomingTime,
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
                  time: incomingTime,
                  status: 'Recebida' as const,
                  messages: [incomingMsg],
                },
                ...next,
              ]
            }
          }
          return next
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

  function now() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!message.trim() || selectedIdx === null) return

    const conv = conversations[selectedIdx]
    const newMsg: Message = {
      id: Date.now().toString(),
      text: message.trim(),
      direction: 'sent',
      time: now(),
    }
    const msgText = message.trim()

    // Optimistic update
    setConversations((prev) =>
      prev.map((c, i) =>
        i === selectedIdx
          ? { ...c, messages: [...c.messages, newMsg], last: msgText, time: newMsg.time, status: 'Enviada' }
          : c
      )
    )
    setMessage('')
    setSendStatus('loading')
    setSendError('')

    try {
      const res = await fetch('/api/meta/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: conv.number.replace(/\D/g, ''), message: msgText }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar')
      setSendStatus('idle')
    } catch (err) {
      setSendStatus('error')
      setSendError(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  function handleStartNewConv(e: React.FormEvent) {
    e.preventDefault()
    if (!newNumber.trim()) return
    const name = newName.trim() || newNumber.trim()
    const newConv: Conversation = {
      name,
      number: newNumber.replace(/\D/g, ''),
      last: '',
      time: now(),
      status: 'Enviada',
      messages: [],
    }
    setConversations((prev) => [newConv, ...prev])
    setSelectedIdx(0)
    setShowNewForm(false)
    setNewNumber('')
    setNewName('')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* Channel switcher */}
      <div data-tour="conversas-channels" className="flex items-center gap-2 mb-3 shrink-0 overflow-x-auto overflow-y-hidden scrollbar-thin -mx-1 px-1">
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-brand-600 text-white shadow-sm shrink-0 whitespace-nowrap">
          <WhatsAppGlyph className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-ink-200 text-ink-400 cursor-not-allowed shrink-0 whitespace-nowrap"
          title="Em breve"
        >
          <InstagramGlyph className="w-3.5 h-3.5" />
          Instagram
          <span className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded-full bg-ink-100">em breve</span>
        </button>
        <button
          disabled
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white border border-ink-200 text-ink-400 cursor-not-allowed shrink-0 whitespace-nowrap"
          title="Em breve"
        >
          <FacebookGlyph className="w-3.5 h-3.5" />
          Facebook
          <span className="text-[9px] font-semibold uppercase px-1 py-0.5 rounded-full bg-ink-100">em breve</span>
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
      {/* Left: conversation list — full width on mobile, hidden once a conversation is open */}
      <div
        data-tour="conversas-list"
        className={`w-full lg:w-72 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden shrink-0 ${
          selectedIdx !== null ? 'hidden lg:flex' : 'flex'
        }`}
      >
        <div className="p-3 border-b border-ink-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-ink-900">Conversas</h2>
            <button
              onClick={() => setShowNewForm((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-brand-50 text-brand-600 transition-colors"
              title="Nova conversa"
            >
              {showNewForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
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
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
          {loadingConversas && conversations.length === 0 && (
            <>
              {Array.from({ length: 5 }).map((_, i) => <ConversationRowSkeleton key={i} />)}
            </>
          )}
          {(!loadingConversas || conversations.length > 0) && filtered.map((c) => {
            const idx = conversations.indexOf(c)
            return (
              <div
                key={idx}
                onClick={() => { setSelectedIdx(idx); setSendError('') }}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                  selectedIdx === idx ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-ink-50'
                }`}
              >
                <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-brand-700">{c.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-ink-900 truncate">{c.name}</p>
                    <span className="text-[10px] text-ink-400 shrink-0 ml-1">{c.time}</span>
                  </div>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">{c.last || 'Sem mensagens'}</p>
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
                onClick={() => setSelectedIdx(null)}
                className="lg:hidden -ml-1 p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors shrink-0"
                aria-label="Voltar para a lista"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-brand-700">{currentConv.name[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">{currentConv.name}</p>
                <p className="text-xs text-ink-500">{currentConv.number}</p>
              </div>

              {iaStatus && (
                <button
                  data-tour="conversas-ai-toggle"
                  onClick={() => handleToggleIA(!iaStatus.iaAtiva)}
                  title={iaStatus.iaAtiva ? 'Desativar a IA nessa conversa' : 'Reativar a IA nessa conversa'}
                  className={`ml-auto shrink-0 flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                    iaStatus.iaAtiva
                      ? 'text-brand-700 bg-brand-100 hover:bg-brand-200'
                      : 'text-ink-600 bg-ink-200 hover:bg-ink-300'
                  }`}
                >
                  <Bot className="w-3.5 h-3.5" />
                  {iaStatus.iaAtiva ? 'IA ativa' : 'IA desativada'}
                </button>
              )}
            </div>

            {iaStatus && !iaStatus.iaAtiva && (
              <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-amber-800 min-w-0">
                  <UserCheck className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    IA pausada nessa conversa{iaStatus.motivoTransferencia ? ` — ${iaStatus.motivoTransferencia}` : ''}
                  </span>
                </div>
                <button
                  onClick={() => handleToggleIA(true)}
                  className="shrink-0 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-2.5 py-1 rounded-full transition-colors"
                >
                  Reativar IA
                </button>
              </div>
            )}

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50">
              {currentConv.messages.length === 0 && (
                <div className="text-center text-xs text-ink-400 py-8">Nenhuma mensagem ainda. Envie a primeira!</div>
              )}
              {currentConv.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      msg.direction === 'sent'
                        ? 'bg-brand-600 text-white rounded-br-sm'
                        : 'bg-white text-ink-800 rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-snug">{msg.text}</p>
                    <p className={`text-[10px] mt-1 text-right ${msg.direction === 'sent' ? 'text-brand-200' : 'text-ink-400'}`}>
                      {msg.time}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Error */}
            {sendError && (
              <div className="mx-3 mb-1 flex items-center gap-2 text-xs p-2 rounded-lg bg-red-50 text-red-700 border border-red-100">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                {sendError}
              </div>
            )}

            {/* Input bar */}
            <div data-tour="conversas-input" className="p-3 border-t border-ink-100 bg-white">
              <form onSubmit={handleSend} className="flex items-end gap-2">
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
    </div>
  )
}
