'use client'

import { useEffect, useMemo, useState } from 'react'
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

// A Graph API do Instagram não expõe nenhum campo de "lida/não lida" pra conversas ou
// mensagens — a única saída é controlar isso por aqui: guarda a última vez que cada
// conversa foi aberta (localStorage, por navegador) e compara com `updated_time`.
const LAST_SEEN_KEY = 'ig-inbox-last-seen'

function lerUltimasVisitas(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(LAST_SEEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}

function salvarUltimasVisitas(v: Record<string, string>): void {
  try { localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(v)) } catch {}
}

export default function InboxTab({ connected }: { connected: boolean }) {
  const [me, setMe] = useState<{ id: string | null; username: string | null }>({ id: null, username: null })
  const [ultimasVisitas, setUltimasVisitas] = useState<Record<string, string>>(() => (typeof window !== 'undefined' ? lerUltimasVisitas() : {}))
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
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
        const lista: ConversationSummary[] = data.conversations ?? []
        setConversations(lista)

        // Primeira vez que essa marcação roda nesse navegador (nada salvo ainda) — sem uma base
        // pra comparar, toda conversa pareceria "nova". Em vez disso, considera o que já existe
        // agora como "já visto" e só sinaliza atividade de fato nova a partir daqui em diante.
        setUltimasVisitas((prev) => {
          if (Object.keys(prev).length > 0) return prev
          const seed: Record<string, string> = {}
          for (const c of lista) seed[c.id] = c.updated_time ?? new Date().toISOString()
          salvarUltimasVisitas(seed)
          return seed
        })
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar conversas'))
      .finally(() => setLoadingConversations(false))
  }, [connected])

  useEffect(() => {
    if (selectedIds.length === 0) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dispara o carregamento ao trocar de conversa, mesmo padrão usado nas demais telas
    setLoadingMessages(true)
    Promise.all(
      selectedIds.map((id) =>
        fetch(`/api/instagram/conversations/${id}/messages`)
          .then((res) => res.json())
          .then((data) => (data.error ? [] : (data.messages ?? []) as ThreadMessage[]))
          .catch(() => [] as ThreadMessage[]),
      ),
    )
      .then((porConversa) => {
        // Mescla as threads (mesma pessoa, ids diferentes — ver `grupos`) numa linha do tempo só.
        const todas = porConversa.flat()
        todas.sort((a, b) => new Date(a.created_time ?? 0).getTime() - new Date(b.created_time ?? 0).getTime())
        setMessages(todas)
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar mensagens'))
      .finally(() => setLoadingMessages(false))
  }, [selectedIds])

  function selecionarGrupo(conversationIds: string[]) {
    setSelectedIds(conversationIds)
    setUltimasVisitas((prev) => {
      const agora = new Date().toISOString()
      const next = { ...prev }
      conversationIds.forEach((id) => { next[id] = agora })
      salvarUltimasVisitas(next)
      return next
    })
  }

  // Agrupa conversas pelo mesmo participante — a Meta às vezes cria mais de uma thread
  // (id diferente) pra mesma pessoa (ex: uma pasta de "Solicitações" e outra da caixa
  // principal). Agrupar evita mostrar a mesma pessoa duas vezes na lista.
  const grupos = useMemo(() => {
    const map = new Map<string, { key: string; name: string; profilePic?: string; conversations: ConversationSummary[]; mostRecentTime?: string }>()
    for (const c of conversations) {
      const other = otherParticipant(c, me)
      const key = other?.username ?? other?.id ?? c.id
      const existing = map.get(key)
      if (existing) {
        existing.conversations.push(c)
        if (!existing.profilePic && other?.profile_pic) existing.profilePic = other.profile_pic
        if (c.updated_time && (!existing.mostRecentTime || c.updated_time > existing.mostRecentTime)) existing.mostRecentTime = c.updated_time
      } else {
        map.set(key, { key, name: other?.username ?? other?.id ?? 'Contato desconhecido', profilePic: other?.profile_pic, conversations: [c], mostRecentTime: c.updated_time })
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.mostRecentTime ?? '').localeCompare(a.mostRecentTime ?? ''))
  }, [conversations, me])

  const naoLidasCount = grupos.filter((g) =>
    g.conversations.some((c) => !!c.updated_time && (!ultimasVisitas[c.id] || new Date(c.updated_time) > new Date(ultimasVisitas[c.id]))),
  ).length

  const grupoSelecionado = grupos.find((g) => g.conversations.some((c) => selectedIds.includes(c.id)))
  const selectedConv = grupoSelecionado?.conversations[0]
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
        body: JSON.stringify({ recipientId: recipient.id, conversationId: selectedIds[0], text: body }),
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
      <div className={`w-full lg:w-72 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden shrink-0 ${selectedIds.length > 0 ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-3 border-b border-ink-100 flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink-900">Conversas</h2>
          {naoLidasCount > 0 && (
            <span className="text-[11px] font-semibold text-white bg-brand-600 rounded-full px-2 py-0.5">{naoLidasCount} nova{naoLidasCount > 1 ? 's' : ''}</span>
          )}
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
          {!loadingConversations && grupos.map((g) => {
            const ids = g.conversations.map((c) => c.id)
            const ativo = ids.some((id) => selectedIds.includes(id))
            const algumaNaoLida = g.conversations.some(
              (c) => !!c.updated_time && (!ultimasVisitas[c.id] || new Date(c.updated_time) > new Date(ultimasVisitas[c.id])),
            )
            return (
              <div
                key={g.key}
                onClick={() => selecionarGrupo(ids)}
                className={`flex items-center gap-3 px-3 py-3 cursor-pointer transition-colors ${ativo ? 'bg-brand-50 border-l-2 border-brand-500' : 'hover:bg-ink-50'}`}
              >
                <div className="shrink-0 relative">
                  <Avatar name={g.name} profilePic={g.profilePic} className="w-9 h-9" />
                  {algumaNaoLida && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-brand-600 border-2 border-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs truncate ${algumaNaoLida ? 'font-bold text-ink-900' : 'font-semibold text-ink-900'}`}>@{g.name}</p>
                  <p className={`text-[11px] truncate mt-0.5 ${algumaNaoLida ? 'text-brand-700 font-medium' : 'text-ink-500'}`}>{formatTime(g.mostRecentTime)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`flex-1 flex-col bg-white rounded-xl border border-ink-200 overflow-hidden ${selectedIds.length > 0 ? 'flex' : 'hidden lg:flex'}`}>
        {selectedConv ? (
          <>
            <div className="px-4 py-3 border-b border-ink-100 flex items-center gap-3 bg-ink-50">
              <button onClick={() => setSelectedIds([])} className="lg:hidden -ml-1 p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 transition-colors shrink-0" aria-label="Voltar">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="shrink-0">
                <Avatar name={recipient?.username ?? recipient?.id ?? '?'} profilePic={recipient?.profile_pic} className="w-9 h-9" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{recipient ? `@${recipient.username ?? recipient.id}` : 'Contato desconhecido'}</p>
                {(grupoSelecionado?.conversations.length ?? 0) > 1 && (
                  <p className="text-[11px] text-ink-400">{grupoSelecionado!.conversations.length} conversas mescladas nessa pessoa</p>
                )}
              </div>
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
