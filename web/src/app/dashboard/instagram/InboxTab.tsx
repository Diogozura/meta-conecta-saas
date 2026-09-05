'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

interface ConversationSummary {
  id: string
  updated_time?: string
  participants?: { data: Array<{ id: string; username?: string; profile_pic?: string }> }
}

function Avatar({ name, profilePic, className }: { name: string; profilePic?: string; className: string }) {
  if (profilePic) {
    // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
    return <img src={profilePic} alt="" className={`${className} rounded-full object-cover`} />
  }
  return (
    <div className={`${className} bg-brand-100 rounded-full flex items-center justify-center`}>
      <span className="text-xs font-bold text-brand-700">{name[0]?.toUpperCase()}</span>
    </div>
  )
}

interface ThreadMessage {
  id: string
  from?: { id: string; username?: string }
  message?: string
  created_time?: string
}

// Compara por ID e por username — a Graph API às vezes devolve o participante
// "eu" com um formato de ID diferente do que vem em /me (ex: IGSID vs ID da
// conta), então só comparar por ID deixava a conta conectada aparecendo como
// se fosse ela mesma a outra ponta de toda conversa.
function otherParticipant(conv: ConversationSummary, me: { id: string | null; username: string | null }) {
  const list = conv.participants?.data ?? []
  const other = list.find((p) => p.id !== me.id && (!me.username || p.username !== me.username))
  return other ?? null
}

function formatTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export default function InboxTab({ connected }: { connected: boolean }) {
  const [me, setMe] = useState<{ id: string | null; username: string | null }>({ id: null, username: null })
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  // Busca quem é "eu" (id + username) ANTES de buscar as conversas — se as
  // conversas chegassem primeiro, a lista renderizava com me.id ainda nulo e
  // todo participante batia como "diferente de mim", pegando o participante
  // errado (às vezes a própria conta) até o segundo fetch terminar.
  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoadingConversations(false)
      return
    }
    setLoadingConversations(true)
    fetch('/api/instagram/credentials')
      .then((res) => res.json())
      .then((data) => {
        setMe({ id: data.credentials?.igUserId ?? null, username: data.credentials?.username ?? null })
        return fetch('/api/instagram/conversations')
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setConversations(data.conversations ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar conversas'))
      .finally(() => setLoadingConversations(false))
  }, [connected])

  useEffect(() => {
    if (!selectedId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dispara o carregamento ao trocar de conversa, mesmo padrão usado nas demais telas
    setLoadingMessages(true)
    fetch(`/api/instagram/conversations/${selectedId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setMessages([...(data.messages ?? [])].reverse())
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar mensagens'))
      .finally(() => setLoadingMessages(false))
  }, [selectedId])

  const selectedConv = conversations.find((c) => c.id === selectedId)
  const recipient = selectedConv ? otherParticipant(selectedConv, me) : null

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || !recipient) return

    const body = text.trim()
    setSending(true)
    try {
      const res = await fetch('/api/instagram/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientId: recipient.id, conversationId: selectedId, text: body }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao enviar mensagem')

      setMessages((prev) => [...prev, { id: json.message_id, from: { id: me.id ?? '' }, message: body, created_time: new Date().toISOString() }])
      setText('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mensagem')
    } finally {
      setSending(false)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para ver a caixa de entrada.</div>
  }

  return (
    <div className="flex gap-4 h-[calc(100vh-16rem)] min-h-[420px]">
      <div className={`w-full lg:w-72 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden shrink-0 ${selectedId ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3 border-b border-ink-100">
          <h2 className="text-sm font-bold text-ink-900">Conversas</h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-ink-100">
          {loadingConversations && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-32" />
              </div>
            </div>
          ))}
          {!loadingConversations && conversations.length === 0 && (
            <div className="py-10 text-center text-ink-400 text-xs">Nenhuma conversa ainda.</div>
          )}
          {!loadingConversations && conversations.map((c) => {
            const other = otherParticipant(c, me)
            const name = other?.username ?? other?.id ?? 'Contato desconhecido'
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${selectedId === c.id ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-ink-50'}`}
              >
                <div className="shrink-0">
                  <Avatar name={name} profilePic={other?.profile_pic} className="w-9 h-9" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-ink-900 truncate">@{name}</p>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">{formatTime(c.updated_time)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`flex-1 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden ${selectedId ? 'flex' : 'hidden lg:flex'}`}>
        {selectedConv ? (
          <>
            <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-3 bg-ink-50">
              <button onClick={() => setSelectedId(null)} className="lg:hidden -ml-1 p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors shrink-0" aria-label="Voltar">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="shrink-0">
                <Avatar name={recipient?.username ?? recipient?.id ?? '?'} profilePic={recipient?.profile_pic} className="w-9 h-9" />
              </div>
              <p className="text-sm font-semibold text-ink-900">{recipient ? `@${recipient.username ?? recipient.id}` : 'Contato desconhecido'}</p>
            </div>

            {!recipient && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                Não conseguimos identificar quem é o outro participante dessa conversa — a resposta por aqui está desativada.
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50">
              {loadingMessages && <p className="text-center text-xs text-ink-400 py-8">Carregando...</p>}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center text-xs text-ink-400 py-8">Nenhuma mensagem ainda.</div>
              )}
              {!loadingMessages && messages.map((msg) => {
                const sentByMe = msg.from?.id === me.id || (!!me.username && msg.from?.username === me.username)
                return (
                  <div key={msg.id} className={`flex ${sentByMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${sentByMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white text-ink-900 rounded-bl-sm'}`}>
                      {msg.message}
                      <p className={`text-[10px] mt-1 ${sentByMe ? 'text-brand-100' : 'text-ink-400'}`}>{formatTime(msg.created_time)}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            <form onSubmit={handleSend} className="p-3 border-t border-ink-100 flex items-center gap-2">
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Escreva uma mensagem..."
                disabled={!recipient}
                className="flex-1 px-3 py-2 border border-ink-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:bg-ink-50"
              />
              <button
                type="submit"
                disabled={sending || !text.trim() || !recipient}
                className="p-2 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 hidden lg:flex items-center justify-center text-sm text-ink-400">Selecione uma conversa</div>
        )}
      </div>
    </div>
  )
}
