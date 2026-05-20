'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Search, Send, Loader2, AlertCircle, Plus, X } from 'lucide-react'

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

const initialConversations: Conversation[] = []

export default function ConversasPage() {
  const [conversations, setConversations] = useState<Conversation[]>(initialConversations)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [sendError, setSendError] = useState('')
  const [search, setSearch] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newNumber, setNewNumber] = useState('')
  const [newName, setNewName] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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

  // Polling a cada 3s para receber mensagens do WhatsApp
  useEffect(() => {
    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const { messages, serverTime } = await res.json() as {
          messages: { id: string; from: string; text: string; timestamp: number }[]
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
                  ? { ...c, messages: [...c.messages, incomingMsg], last: incomingMsg.text, time: incomingTime, status: 'Recebida' as const }
                  : c
              )
            } else {
              next = [
                {
                  name: data.from,
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

    const id = setInterval(poll, 3000)
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
    <div className="flex gap-4 h-[calc(100vh-7rem)]">
      {/* Left: conversation list */}
      <div className="w-72 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden shrink-0">
        <div className="p-3 border-b border-gray-100 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-900">Conversas</h2>
            <button
              onClick={() => setShowNewForm((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors"
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
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <input
                type="text"
                value={newNumber}
                onChange={(e) => setNewNumber(e.target.value)}
                placeholder="Número (Ex: 5511999990000)"
                required
                className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              <button
                type="submit"
                className="w-full py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Iniciar conversa
              </button>
            </form>
          )}

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-8 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {filtered.map((c) => {
            const idx = conversations.indexOf(c)
            return (
              <div
                key={idx}
                onClick={() => { setSelectedIdx(idx); setSendError('') }}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${
                  selectedIdx === idx ? 'bg-green-50 border-l-2 border-green-500' : 'hover:bg-gray-50'
                }`}
              >
                <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-green-700">{c.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-900 truncate">{c.name}</p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-1">{c.time}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.last || 'Sem mensagens'}</p>
                </div>
              </div>
            )
          })}
          {filtered.length === 0 && (
            <div className="py-10 text-center text-gray-400 text-xs">Nenhuma conversa encontrada.</div>
          )}
        </div>
      </div>

      {/* Right: chat panel */}
      <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
        {currentConv ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 bg-gray-50">
              <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-green-700">{currentConv.name[0]}</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">{currentConv.name}</p>
                <p className="text-xs text-gray-500">{currentConv.number}</p>
              </div>
            </div>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f0f2f5]">
              {currentConv.messages.length === 0 && (
                <div className="text-center text-xs text-gray-400 py-8">Nenhuma mensagem ainda. Envie a primeira!</div>
              )}
              {currentConv.messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.direction === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                      msg.direction === 'sent'
                        ? 'bg-green-600 text-white rounded-br-sm'
                        : 'bg-white text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    <p className="leading-snug">{msg.text}</p>
                    <p className={`text-[10px] mt-1 text-right ${msg.direction === 'sent' ? 'text-green-200' : 'text-gray-400'}`}>
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
            <div className="p-3 border-t border-gray-100 bg-white">
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
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
                  style={{ maxHeight: '120px' }}
                />
                <button
                  type="submit"
                  disabled={sendStatus === 'loading' || !message.trim()}
                  className="p-2.5 bg-green-600 text-white rounded-full hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
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
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-[#f0f2f5]">
            <MessageSquare className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm font-medium">Selecione uma conversa</p>
            <p className="text-xs mt-1 opacity-70">ou clique em + para iniciar uma nova</p>
          </div>
        )}
      </div>
    </div>
  )
}
