'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Send, Users, Ticket as TicketIcon, UserPlus, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import { useConfirmDialog } from '@/components/ConfirmDialog'

interface ConversationSummary {
  id: string
  updated_time?: string
  participants?: { data: Array<{ id: string; username?: string; profile_pic?: string }> }
}

const URL_REGEX_SPLIT = /(https?:\/\/[^\s]+)/g
const URL_REGEX_TEST = /^https?:\/\//

/**
 * Perfil compartilhado na DM chega como texto puro (a própria URL do Instagram), não como um
 * anexo especial — então em vez de um "card" (precisaria buscar dados do perfil, que a API não
 * libera pra usuário arbitrário), pelo menos vira link clicável de verdade.
 */
function LinkifiedText({ text }: { text: string }) {
  const partes = text.split(URL_REGEX_SPLIT)
  return (
    <>
      {partes.map((parte, i) =>
        URL_REGEX_TEST.test(parte)
          ? <a key={i} href={parte} target="_blank" rel="noopener noreferrer" className="underline break-all">{parte}</a>
          : <span key={i}>{parte}</span>,
      )}
    </>
  )
}

function Avatar({ name, profilePic, isGroup, className }: { name: string; profilePic?: string; isGroup?: boolean; className: string }) {
  if (profilePic) {
    // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
    return <img src={profilePic} alt="" className={`${className} rounded-full object-cover`} />
  }
  return (
    <div className={`${className} bg-brand-100 rounded-full flex items-center justify-center`}>
      {isGroup ? <Users className="w-1/2 h-1/2 text-brand-700" /> : <span className="text-xs font-bold text-brand-700">{name[0]?.toUpperCase()}</span>}
    </div>
  )
}

interface ThreadMessageAttachment {
  id?: string
  file_url?: string
  image_data?: { url?: string; media_url?: string }
  video_data?: { url?: string }
}

interface ThreadMessageShare {
  id?: string
  name?: string
  description?: string
  type?: string
  url?: string
}

interface ThreadMessage {
  id: string
  from?: { id: string; username?: string }
  message?: string
  created_time?: string
  attachments?: { data: ThreadMessageAttachment[] }
  shares?: { data: ThreadMessageShare[] } | ThreadMessageShare
  story?: Record<string, unknown>
  // Diagnóstico bruto do que a Meta devolveu de verdade nas chamadas de shares/story pra essa
  // mensagem — ver lib/instagram.ts::listConversationMessages. `null` = a mensagem nem apareceu
  // no lote buscado; um objeto = apareceu, com o que veio (mesmo vazio).
  debugShares?: unknown
  debugStory?: unknown
}

/** `shares` às vezes vem como objeto único, às vezes como `{data: [...]}` — normaliza pro primeiro item. */
function primeiroShare(shares: ThreadMessage['shares']): ThreadMessageShare | undefined {
  if (!shares) return undefined
  if ('data' in shares) return shares.data?.[0]
  return shares
}

// Formato real do campo "story" ainda não confirmado pra esse tipo de login (a API rejeitou todo
// subcampo testado até agora), então em vez de assumir uma chave fixa, varre os valores do objeto
// (1 nível) procurando algo que pareça uma URL de mídia.
function extrairUrlDeStory(story: ThreadMessage['story']): string | undefined {
  if (!story) return undefined
  for (const valor of Object.values(story)) {
    if (typeof valor === 'string' && /^https?:\/\//.test(valor)) return valor
  }
  return undefined
}

// Compara por ID e por username — a Graph API às vezes devolve o participante
// "eu" com um formato de ID diferente do que vem em /me (ex: IGSID vs ID da
// conta), então só comparar por ID deixava a conta conectada aparecendo como
// se fosse ela mesma a outra ponta de toda conversa.
// Devolve TODOS os outros participantes — uma conversa em grupo tem mais de
// um, e usar só o primeiro (como antes) fazia um grupo aparecer na lista
// como se fosse uma conversa 1:1 com uma pessoa só.
function otherParticipants(conv: ConversationSummary, me: { id: string | null; username: string | null }) {
  const list = conv.participants?.data ?? []
  return list.filter((p) => p.id !== me.id && (!me.username || p.username !== me.username))
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

// Controla se a "semeadura" inicial (tratar o que já existe como já visto, ver useEffect de
// carregar conversas) já rodou nesse navegador — precisa ser um flag à parte, não só "o mapa
// está vazio", senão quem já tinha clicado em 1-2 conversas antes dessa lógica existir nunca
// teria as OUTRAS semeadas, ficando marcadas como não lidas pra sempre.
const SEEDED_KEY = 'ig-inbox-seeded'

function jaSemeado(): boolean {
  try { return localStorage.getItem(SEEDED_KEY) === '1' } catch { return false }
}

export default function InboxTab({ connected }: { connected: boolean }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [me, setMe] = useState<{ id: string | null; username: string | null }>({ id: null, username: null })
  const [usernamesClientes, setUsernamesClientes] = useState<Set<string> | null>(null)
  const [usernamesBloqueados, setUsernamesBloqueados] = useState<Set<string> | null>(null)
  const [ticketAlvo, setTicketAlvo] = useState<{ username: string } | null>(null)
  const [ticketAssunto, setTicketAssunto] = useState('')
  const [criandoTicket, setCriandoTicket] = useState(false)
  const [leadAlvo, setLeadAlvo] = useState<{ username: string } | null>(null)
  const [leadNome, setLeadNome] = useState('')
  const [criandoLead, setCriandoLead] = useState(false)
  const [ultimasVisitas, setUltimasVisitas] = useState<Record<string, string>>(() => (typeof window !== 'undefined' ? lerUltimasVisitas() : {}))
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [messages, setMessages] = useState<ThreadMessage[]>([])
  const [sharesStoryErro, setSharesStoryErro] = useState<string | undefined>(undefined)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!connected) return
    fetch('/api/clientes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { clientes: { instagram?: string }[] } | null) => {
        setUsernamesClientes(new Set((data?.clientes ?? []).map((c) => c.instagram).filter((u): u is string => !!u)))
      })
      .catch(() => setUsernamesClientes(new Set()))
    fetch('/api/instagram/bloqueados')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bloqueados: { id: string }[] } | null) => {
        setUsernamesBloqueados(new Set((data?.bloqueados ?? []).map((b) => b.id)))
      })
      .catch(() => setUsernamesBloqueados(new Set()))
  }, [connected])

  async function handleBloquearUsuario(username: string) {
    if (!(await confirm(`Bloquear @${username}? Comentários novos dele passam a ser ocultados automaticamente.`, { confirmLabel: 'Bloquear' }))) return
    try {
      const res = await fetch('/api/instagram/bloqueados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao bloquear')
      setUsernamesBloqueados((prev) => new Set([...(prev ?? []), username]))
      toast.success(`@${username} bloqueado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao bloquear usuário')
    }
  }

  async function handleDesbloquearUsuario(username: string) {
    setUsernamesBloqueados((prev) => {
      const next = new Set(prev)
      next.delete(username)
      return next
    })
    await fetch(`/api/instagram/bloqueados/${username}`, { method: 'DELETE' }).catch(() => {})
  }

  async function handleCriarTicket() {
    if (!ticketAlvo || !ticketAssunto.trim()) return
    setCriandoTicket(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: ticketAlvo.username, origem: 'instagram', assunto: ticketAssunto.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar ticket')
      toast.success(`Ticket #${json.ticket.protocolo} criado.`)
      setTicketAlvo(null)
      setTicketAssunto('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar ticket')
    } finally {
      setCriandoTicket(false)
    }
  }

  async function handleCriarLead() {
    if (!leadAlvo || !leadNome.trim()) return
    setCriandoLead(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: leadNome.trim(), instagram: leadAlvo.username, tag: 'Lead' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar lead')
      setUsernamesClientes((prev) => new Set([...(prev ?? []), leadAlvo.username]))
      toast.success('Lead criado no CRM.')
      setLeadAlvo(null)
      setLeadNome('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setCriandoLead(false)
    }
  }

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

        // Primeira vez que essa marcação roda nesse navegador — sem uma base pra comparar, toda
        // conversa pareceria "nova". Em vez disso, considera o que já existe agora como "já
        // visto" (uma única vez, controlado por SEEDED_KEY) e só sinaliza atividade de fato nova
        // a partir daqui em diante — inclusive pra conversas que já tinham sido clicadas antes
        // dessa marcação existir.
        if (!jaSemeado()) {
          setUltimasVisitas((prev) => {
            const next = { ...prev }
            for (const c of lista) if (!next[c.id]) next[c.id] = c.updated_time ?? new Date().toISOString()
            salvarUltimasVisitas(next)
            return next
          })
          try { localStorage.setItem(SEEDED_KEY, '1') } catch {}
        }
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
          .then((data) => (data.error ? { messages: [], sharesStoryErro: undefined } : { messages: (data.messages ?? []) as ThreadMessage[], sharesStoryErro: data.sharesStoryErro as string | undefined }))
          .catch(() => ({ messages: [] as ThreadMessage[], sharesStoryErro: undefined })),
      ),
    )
      .then((porConversa) => {
        // Mescla as threads (mesma pessoa, ids diferentes — ver `grupos`) numa linha do tempo só.
        const todas = porConversa.flatMap((r) => r.messages)
        todas.sort((a, b) => new Date(a.created_time ?? 0).getTime() - new Date(b.created_time ?? 0).getTime())
        setMessages(todas)
        setSharesStoryErro(porConversa.find((r) => r.sharesStoryErro)?.sharesStoryErro)
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
    const map = new Map<string, { key: string; name: string; profilePic?: string; isGroup: boolean; conversations: ConversationSummary[]; mostRecentTime?: string }>()
    for (const c of conversations) {
      const outros = otherParticipants(c, me)
      const isGroup = outros.length > 1
      // Grupo: agrupa pelo conjunto de participantes (ordenado, pra não depender da ordem que a
      // API devolve) — duas threads com exatamente as mesmas pessoas contam como o mesmo grupo.
      const key = isGroup
        ? outros.map((p) => p.username ?? p.id).sort().join('|')
        : (outros[0]?.username ?? outros[0]?.id ?? c.id)
      const name = isGroup ? outros.map((p) => p.username ?? p.id).join(', ') : (outros[0]?.username ?? outros[0]?.id ?? 'Contato desconhecido')
      const existing = map.get(key)
      if (existing) {
        existing.conversations.push(c)
        if (!existing.profilePic && !isGroup && outros[0]?.profile_pic) existing.profilePic = outros[0].profile_pic
        if (c.updated_time && (!existing.mostRecentTime || c.updated_time > existing.mostRecentTime)) existing.mostRecentTime = c.updated_time
      } else {
        map.set(key, { key, name, profilePic: isGroup ? undefined : outros[0]?.profile_pic, isGroup, conversations: [c], mostRecentTime: c.updated_time })
      }
    }
    return Array.from(map.values()).sort((a, b) => (b.mostRecentTime ?? '').localeCompare(a.mostRecentTime ?? ''))
  }, [conversations, me])

  const naoLidasCount = grupos.filter((g) =>
    g.conversations.some((c) => !!c.updated_time && (!ultimasVisitas[c.id] || new Date(c.updated_time) > new Date(ultimasVisitas[c.id]))),
  ).length

  const grupoSelecionado = grupos.find((g) => g.conversations.some((c) => selectedIds.includes(c.id)))
  const selectedConv = grupoSelecionado?.conversations[0]
  const outrosDaConversa = selectedConv ? otherParticipants(selectedConv, me) : []
  // A API de envio do Instagram (me/messages) manda pra 1 destinatário só — não dá pra responder
  // um grupo por aqui (a Meta não expõe um jeito de mandar pra uma conversa em grupo inteira).
  const recipient = outrosDaConversa.length === 1 ? outrosDaConversa[0] : null

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
                  <Avatar name={g.name} profilePic={g.profilePic} isGroup={g.isGroup} className="w-9 h-9" />
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
                <Avatar name={grupoSelecionado?.name ?? '?'} profilePic={recipient?.profile_pic} isGroup={grupoSelecionado?.isGroup} className="w-9 h-9" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">
                  {grupoSelecionado?.isGroup ? grupoSelecionado.name : recipient ? `@${recipient.username ?? recipient.id}` : (grupoSelecionado?.name ?? 'Contato desconhecido')}
                </p>
                {(grupoSelecionado?.conversations.length ?? 0) > 1 && (
                  <p className="text-[11px] text-ink-400">{grupoSelecionado!.conversations.length} conversas mescladas nessa pessoa</p>
                )}
              </div>
              {recipient?.username && (
                <div className="ml-auto flex items-center gap-1 shrink-0">
                  {usernamesClientes?.has(recipient.username) ? (
                    <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-100 text-brand-700">já é cliente</span>
                  ) : (
                    <button type="button" onClick={() => { setLeadAlvo({ username: recipient.username! }); setLeadNome(recipient.username!) }} className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100" title="Transformar em lead">
                      <UserPlus className="w-4 h-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => { setTicketAlvo({ username: recipient.username! }); setTicketAssunto('') }} className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100" title="Transformar em ticket">
                    <TicketIcon className="w-4 h-4" />
                  </button>
                  {usernamesBloqueados?.has(recipient.username) ? (
                    <button type="button" onClick={() => handleDesbloquearUsuario(recipient.username!)} className="p-1.5 text-red-500 hover:text-red-700 rounded-lg hover:bg-ink-100" title="Desbloquear">
                      <UserX className="w-4 h-4" />
                    </button>
                  ) : (
                    <button type="button" onClick={() => handleBloquearUsuario(recipient.username!)} className="p-1.5 text-ink-400 hover:text-red-600 rounded-lg hover:bg-ink-100" title="Bloquear usuário">
                      <UserX className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {!recipient && (
              <div className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                {outrosDaConversa.length > 1
                  ? 'Essa é uma conversa em grupo — a API de mensagens do Instagram não permite responder um grupo pelo painel, só 1:1.'
                  : 'Não conseguimos identificar quem é o outro participante dessa conversa — a resposta por aqui está desativada.'}
              </div>
            )}

            {sharesStoryErro && (
              <details className="px-4 py-2 bg-amber-50 border-b border-amber-100 text-xs text-amber-800">
                <summary className="cursor-pointer">Reels/posts/stories compartilhados não puderam ser buscados nessa conversa — clique pra ver o erro</summary>
                <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all">{sharesStoryErro}</pre>
              </details>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-ink-50">
              {loadingMessages && <p className="text-center text-xs text-ink-400 py-8">Carregando...</p>}
              {!loadingMessages && messages.length === 0 && (
                <div className="text-center text-xs text-ink-400 py-8">Nenhuma mensagem ainda.</div>
              )}
              {!loadingMessages && messages.map((msg) => {
                const sentByMe = msg.from?.id === me.id || (!!me.username && msg.from?.username === me.username)
                const anexo = msg.attachments?.data?.[0]
                const imagemUrl = anexo?.image_data?.url ?? anexo?.image_data?.media_url
                const videoUrl = anexo?.video_data?.url
                const audioUrl = !imagemUrl && !videoUrl ? anexo?.file_url : undefined
                const share = primeiroShare(msg.shares)
                const storyLink = extrairUrlDeStory(msg.story)
                const shareEhVideo = share?.type === 'reel' || share?.type === 'ig_reel'
                const shareEhImagemDeMidia = share?.type === 'post' || share?.type === 'ig_post'
                const midiaClass = 'max-w-[220px] max-h-[280px] w-auto h-auto rounded-lg mb-1 object-contain'
                const temShare = !!(share?.url || share?.name || share?.description)
                const semNadaReconhecido = !msg.message && !imagemUrl && !videoUrl && !audioUrl && !storyLink && !temShare
                return (
                  <div key={msg.id} className={`flex ${sentByMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm shadow-sm ${sentByMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white text-ink-900 rounded-bl-sm'}`}>
                      {imagemUrl && (
                        // eslint-disable-next-line @next/next/no-img-element -- imagem vinda da CDN da Meta, sem domínio fixo pra configurar no next/image
                        <img src={imagemUrl} alt="" className={midiaClass} />
                      )}
                      {videoUrl && <video src={videoUrl} controls className={midiaClass} />}
                      {audioUrl && <audio src={audioUrl} controls className="max-w-[220px] mb-1" />}
                      {storyLink && (
                        <div className="mb-1">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">Story</span>
                          {/* eslint-disable-next-line @next/next/no-img-element -- imagem vinda da CDN da Meta */}
                          <img src={storyLink} alt="" className={midiaClass} />
                        </div>
                      )}
                      {temShare && (
                        <div className="mb-1">
                          <span className="text-[10px] uppercase tracking-wide opacity-70">{share!.type ?? 'Compartilhado'}</span>
                          {share!.url && (
                            shareEhVideo ? (
                              <video src={share!.url} controls className={midiaClass} />
                            ) : shareEhImagemDeMidia ? (
                              // eslint-disable-next-line @next/next/no-img-element -- imagem vinda da CDN da Meta
                              <img src={share!.url} alt={share!.name ?? ''} className={midiaClass} />
                            ) : (
                              // Tipo desconhecido (ex: perfil compartilhado) — a url pode não ser uma
                              // mídia de verdade, então vira link clicável em vez de tentar exibir como imagem.
                              <a href={share!.url} target="_blank" rel="noopener noreferrer" className="underline break-all block">{share!.url}</a>
                            )
                          )}
                          {(share!.name || share!.description) && <p className="text-xs mt-1 opacity-80">{share!.name || share!.description}</p>}
                        </div>
                      )}
                      {semNadaReconhecido && (
                        // A Meta não devolveu nada reconhecível nesses campos — mas SEMPRE dá pra
                        // ver o diagnóstico bruto agora (debugShares/debugStory mostram o que a
                        // chamada de fato devolveu pra essa mensagem, mesmo vazio), pra investigar
                        // por que ela não manda o dado em vez de só constatar que não veio.
                        <details className={`text-xs ${sentByMe ? 'text-brand-100' : 'text-ink-400'}`}>
                          <summary className="italic cursor-pointer">Conteúdo (áudio, Reels ou outro compartilhamento) sem dado reconhecido — clique pra ver o diagnóstico</summary>
                          <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all opacity-80">{JSON.stringify({ attachments: msg.attachments, shares: msg.shares, story: msg.story, debugShares: msg.debugShares, debugStory: msg.debugStory }, null, 2)}</pre>
                        </details>
                      )}
                      {msg.message && <LinkifiedText text={msg.message} />}
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

      <Modal open={!!ticketAlvo} onClose={() => setTicketAlvo(null)} title="Transformar em ticket">
        <div className="space-y-3">
          <p className="text-xs text-ink-500">DM de @{ticketAlvo?.username}</p>
          <input
            value={ticketAssunto}
            onChange={(e) => setTicketAssunto(e.target.value)}
            placeholder="Assunto do ticket"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm"
          />
          <button type="button" onClick={handleCriarTicket} disabled={criandoTicket || !ticketAssunto.trim()} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {criandoTicket ? 'Criando...' : 'Criar ticket'}
          </button>
        </div>
      </Modal>

      <Modal open={!!leadAlvo} onClose={() => setLeadAlvo(null)} title="Transformar em lead">
        <div className="space-y-3">
          <p className="text-xs text-ink-500">DM de @{leadAlvo?.username}</p>
          <input
            value={leadNome}
            onChange={(e) => setLeadNome(e.target.value)}
            placeholder="Nome do lead"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm"
          />
          <button type="button" onClick={handleCriarLead} disabled={criandoLead || !leadNome.trim()} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50">
            {criandoLead ? 'Criando...' : 'Criar lead no CRM'}
          </button>
        </div>
      </Modal>
      {ConfirmDialogElement}
    </div>
  )
}
