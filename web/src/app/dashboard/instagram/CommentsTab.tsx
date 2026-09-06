'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, MessageCircle, Send, MessageSquareText, Search, ShieldAlert, Languages, EyeOff, Ticket as TicketIcon, UserPlus, UserX, Sparkles, ChevronDown, ChevronUp, X } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'
import { useConfirmDialog } from '@/components/ConfirmDialog'

interface RespostaRapida {
  id: string
  atalho: string
  texto: string
}

interface Media {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  thumbnail_url?: string
  permalink?: string
  timestamp?: string
  comments_count?: number
}

interface Comment {
  id: string
  text: string
  username?: string
  timestamp?: string
}

interface PerguntaFrequente {
  id: string
  pergunta: string
  resposta: string
}

interface Bloqueado {
  id: string
  motivo?: string
  criadoEm: string
}

type Sentimento = 'elogio' | 'duvida' | 'reclamacao' | 'outro'

const SENTIMENTO_INFO: Record<Sentimento, { label: string; cor: string }> = {
  elogio: { label: 'Elogio', cor: 'bg-brand-100 text-brand-700' },
  duvida: { label: 'Dúvida', cor: 'bg-blue-100 text-blue-700' },
  reclamacao: { label: 'Reclamação', cor: 'bg-red-100 text-red-700' },
  outro: { label: 'Outro', cor: 'bg-ink-100 text-ink-500' },
}

interface SearchResult {
  comentarios: { id: string; text: string; from: string; mediaId: string }[]
  mensagens: { conversationId: string; participante?: string; mensagem: string; createdTime?: string }[]
  conversasBuscadas: number
  totalConversas: number
}

function formatDate(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function CommentsTab({ connected }: { connected: boolean }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [media, setMedia] = useState<Media[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [loadingComments, setLoadingComments] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replying, setReplying] = useState<string | null>(null)
  const [respostasRapidas, setRespostasRapidas] = useState<RespostaRapida[] | null>(null)
  const [respostasAbertoPara, setRespostasAbertoPara] = useState<string | null>(null)

  // Moderação, FAQ e bloqueio (itens 24, 29, 32)
  const [moderacaoAberta, setModeracaoAberta] = useState(false)
  const [moderacaoAtiva, setModeracaoAtiva] = useState(false)
  const [termosModeracaoInput, setTermosModeracaoInput] = useState('')
  const [faqAtiva, setFaqAtiva] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [perguntas, setPerguntas] = useState<PerguntaFrequente[] | null>(null)
  const [novaPergunta, setNovaPergunta] = useState('')
  const [novaResposta, setNovaResposta] = useState('')
  const [bloqueados, setBloqueados] = useState<Bloqueado[] | null>(null)
  const [novoBloqueio, setNovoBloqueio] = useState('')

  // "Já é cliente" (item 25) — carrega a lista de clientes com Instagram cadastrado uma vez.
  const [usernamesClientes, setUsernamesClientes] = useState<Set<string> | null>(null)

  // Sentimento (23) e tradução (30)
  const [sentimentos, setSentimentos] = useState<Record<string, Sentimento>>({})
  const [classificandoMediaId, setClassificandoMediaId] = useState<string | null>(null)
  const [traducoes, setTraducoes] = useState<Record<string, string>>({})
  const [traduzindoId, setTraduzindoId] = useState<string | null>(null)
  const [ocultandoId, setOcultandoId] = useState<string | null>(null)

  // Busca (31)
  const [buscaQuery, setBuscaQuery] = useState('')
  const [buscaResultado, setBuscaResultado] = useState<SearchResult | null>(null)
  const [buscando, setBuscando] = useState(false)

  // Ticket (26) e lead (27)
  const [ticketAlvo, setTicketAlvo] = useState<Comment | null>(null)
  const [ticketAssunto, setTicketAssunto] = useState('')
  const [criandoTicket, setCriandoTicket] = useState(false)
  const [leadAlvo, setLeadAlvo] = useState<Comment | null>(null)
  const [leadNome, setLeadNome] = useState('')
  const [criandoLead, setCriandoLead] = useState(false)

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    setLoading(true)
    fetch('/api/instagram/media')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setMedia(data.media ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar publicações'))
      .finally(() => setLoading(false))

    fetch('/api/conta/instagram-publish-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { config: { moderacaoAutomaticaAtiva?: boolean; termosModeracao?: string[]; faqAtiva?: boolean } } | null) => {
        const config = data?.config ?? {}
        setModeracaoAtiva(!!config.moderacaoAutomaticaAtiva)
        setTermosModeracaoInput((config.termosModeracao ?? []).join(', '))
        setFaqAtiva(!!config.faqAtiva)
      })
      .catch(() => {})

    fetch('/api/clientes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { clientes: { instagram?: string }[] } | null) => {
        const usernames = (data?.clientes ?? []).map((c) => c.instagram).filter((u): u is string => !!u)
        setUsernamesClientes(new Set(usernames))
      })
      .catch(() => setUsernamesClientes(new Set()))
  }, [connected])

  function carregarPerguntas() {
    if (perguntas !== null) return
    fetch('/api/instagram/perguntas-frequentes')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { perguntas: PerguntaFrequente[] } | null) => setPerguntas(data?.perguntas ?? []))
      .catch(() => setPerguntas([]))
  }

  function carregarBloqueados() {
    if (bloqueados !== null) return
    fetch('/api/instagram/bloqueados')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { bloqueados: Bloqueado[] } | null) => setBloqueados(data?.bloqueados ?? []))
      .catch(() => setBloqueados([]))
  }

  async function handleSalvarModeracao() {
    setSavingConfig(true)
    try {
      const termosModeracao = termosModeracaoInput.split(',').map((t) => t.trim()).filter(Boolean)
      const res = await fetch('/api/conta/instagram-publish-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moderacaoAutomaticaAtiva: moderacaoAtiva, termosModeracao, faqAtiva }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      toast.success('Configuração salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar configuração')
    } finally {
      setSavingConfig(false)
    }
  }

  async function handleCriarPergunta() {
    if (!novaPergunta.trim() || !novaResposta.trim()) return
    try {
      const res = await fetch('/api/instagram/perguntas-frequentes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pergunta: novaPergunta.trim(), resposta: novaResposta.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar')
      setPerguntas((prev) => [...(prev ?? []), json.pergunta])
      setNovaPergunta('')
      setNovaResposta('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar pergunta frequente')
    }
  }

  async function handleExcluirPergunta(id: string) {
    setPerguntas((prev) => (prev ?? []).filter((p) => p.id !== id))
    await fetch(`/api/instagram/perguntas-frequentes/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function handleBloquear(username: string) {
    if (!username.trim()) return
    try {
      const res = await fetch('/api/instagram/bloqueados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao bloquear')
      setBloqueados((prev) => [json.bloqueado, ...(prev ?? [])])
      setNovoBloqueio('')
      toast.success(`@${username.trim().replace(/^@/, '')} bloqueado.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao bloquear usuário')
    }
  }

  async function handleDesbloquear(username: string) {
    setBloqueados((prev) => (prev ?? []).filter((b) => b.id !== username))
    await fetch(`/api/instagram/bloqueados/${username}`, { method: 'DELETE' }).catch(() => {})
  }

  async function toggleExpand(mediaId: string) {
    if (expandedId === mediaId) {
      setExpandedId(null)
      return
    }
    setExpandedId(mediaId)
    if (comments[mediaId]) return

    setLoadingComments(mediaId)
    try {
      const res = await fetch(`/api/instagram/media/${mediaId}/comments`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao carregar comentários')
      setComments((prev) => ({ ...prev, [mediaId]: data.comments ?? [] }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao carregar comentários')
    } finally {
      setLoadingComments(null)
    }
  }

  async function handleClassificar(mediaId: string) {
    const lista = comments[mediaId] ?? []
    if (lista.length === 0) return
    setClassificandoMediaId(mediaId)
    try {
      const res = await fetch('/api/instagram/comments/classificar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comentarios: lista.map((c) => ({ id: c.id, text: c.text })) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao classificar')
      setSentimentos((prev) => ({ ...prev, ...json.classificacoes }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao classificar comentários')
    } finally {
      setClassificandoMediaId(null)
    }
  }

  async function handleTraduzir(commentId: string, texto: string) {
    setTraduzindoId(commentId)
    try {
      const res = await fetch('/api/instagram/traduzir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao traduzir')
      setTraducoes((prev) => ({ ...prev, [commentId]: json.traducao }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao traduzir')
    } finally {
      setTraduzindoId(null)
    }
  }

  async function handleOcultar(mediaId: string, commentId: string, hide: boolean) {
    setOcultandoId(commentId)
    try {
      const res = await fetch(`/api/instagram/comments/${commentId}/hide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hide, mediaId }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro ao ocultar')
      toast.success(hide ? 'Comentário ocultado.' : 'Comentário reexibido.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ocultar comentário')
    } finally {
      setOcultandoId(null)
    }
  }

  async function handleBuscar() {
    if (buscaQuery.trim().length < 2) return
    setBuscando(true)
    try {
      const res = await fetch(`/api/instagram/search?q=${encodeURIComponent(buscaQuery.trim())}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro na busca')
      setBuscaResultado(json)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro na busca')
    } finally {
      setBuscando(false)
    }
  }

  async function handleCriarTicket() {
    if (!ticketAlvo?.username || !ticketAssunto.trim()) return
    setCriandoTicket(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero: ticketAlvo.username,
          origem: 'instagram',
          assunto: ticketAssunto.trim(),
          descricao: ticketAlvo.text,
        }),
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
    if (!leadAlvo?.username || !leadNome.trim()) return
    setCriandoLead(true)
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: leadNome.trim(), instagram: leadAlvo.username, tag: 'Lead', notas: `Comentário: "${leadAlvo.text}"` }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar lead')
      setUsernamesClientes((prev) => new Set([...(prev ?? []), leadAlvo.username!]))
      toast.success('Lead criado no CRM.')
      setLeadAlvo(null)
      setLeadNome('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar lead')
    } finally {
      setCriandoLead(false)
    }
  }

  function toggleRespostasRapidas(commentId: string) {
    const abrindo = respostasAbertoPara !== commentId
    setRespostasAbertoPara(abrindo ? commentId : null)
    if (abrindo && respostasRapidas === null) {
      fetch('/api/respostas-rapidas')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { respostas: RespostaRapida[] } | null) => setRespostasRapidas(data?.respostas ?? []))
        .catch(() => setRespostasRapidas([]))
    }
  }

  function inserirRespostaRapida(commentId: string, texto: string) {
    setReplyText((prev) => ({ ...prev, [commentId]: texto }))
    setRespostasAbertoPara(null)
  }

  async function handleReply(mediaId: string, commentId: string) {
    const message = replyText[commentId]?.trim()
    if (!message) return

    setReplying(commentId)
    try {
      const res = await fetch(`/api/instagram/comments/${commentId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, mediaId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao responder')
      toast.success('Resposta publicada.')
      setReplyText((prev) => ({ ...prev, [commentId]: '' }))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao responder comentário')
    } finally {
      setReplying(null)
    }
  }

  const totalBloqueados = useMemo(() => bloqueados?.length ?? 0, [bloqueados])

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; para gerenciar comentários.</div>
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
      </div>
    )
  }

  return (
    <div className="space-y-3 max-w-3xl">
      <div className="bg-white rounded-xl border border-ink-200 p-3 flex items-center gap-2">
        <Search className="w-4 h-4 text-ink-400 shrink-0" />
        <input
          value={buscaQuery}
          onChange={(e) => setBuscaQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleBuscar()}
          placeholder="Buscar palavra-chave em comentários e DMs recentes..."
          className="flex-1 text-sm focus:outline-none"
        />
        {buscaResultado && (
          <button type="button" onClick={() => { setBuscaResultado(null); setBuscaQuery('') }} className="text-ink-400 hover:text-ink-700" aria-label="Limpar busca">
            <X className="w-4 h-4" />
          </button>
        )}
        <button type="button" onClick={handleBuscar} disabled={buscando || buscaQuery.trim().length < 2} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
          {buscando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Buscar'}
        </button>
      </div>

      {buscaResultado && (
        <div className="bg-white rounded-xl border border-ink-200 p-3 space-y-3">
          <p className="text-xs text-ink-400">DMs buscadas nas {buscaResultado.conversasBuscadas} conversas mais recentes (de {buscaResultado.totalConversas} no total) — não é um histórico completo indexado.</p>
          {buscaResultado.comentarios.length === 0 && buscaResultado.mensagens.length === 0 ? (
            <p className="text-sm text-ink-400">Nada encontrado.</p>
          ) : (
            <>
              {buscaResultado.comentarios.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-600 mb-1">Comentários ({buscaResultado.comentarios.length})</p>
                  <div className="space-y-1.5">
                    {buscaResultado.comentarios.map((c) => (
                      <p key={c.id} className="text-xs text-ink-700 bg-ink-50 rounded-md px-2.5 py-1.5"><span className="font-semibold">@{c.from}</span>: {c.text}</p>
                    ))}
                  </div>
                </div>
              )}
              {buscaResultado.mensagens.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-ink-600 mb-1">DMs ({buscaResultado.mensagens.length})</p>
                  <div className="space-y-1.5">
                    {buscaResultado.mensagens.map((m, i) => (
                      <p key={i} className="text-xs text-ink-700 bg-ink-50 rounded-md px-2.5 py-1.5"><span className="font-semibold">@{m.participante ?? 'desconhecido'}</span>: {m.mensagem}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-ink-200">
        <button type="button" onClick={() => setModeracaoAberta((v) => !v)} className="w-full flex items-center gap-2 p-3 text-sm font-semibold text-ink-800">
          <ShieldAlert className="w-4 h-4 text-amber-500" /> Moderação & respostas automáticas
          {moderacaoAberta ? <ChevronUp className="w-4 h-4 ml-auto text-ink-400" /> : <ChevronDown className="w-4 h-4 ml-auto text-ink-400" />}
        </button>
        {moderacaoAberta && (
          <div className="border-t border-ink-100 p-3 space-y-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={moderacaoAtiva} onChange={(e) => setModeracaoAtiva(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                Ocultar automaticamente comentário com palavrão ou spam
              </label>
              <input
                value={termosModeracaoInput}
                onChange={(e) => setTermosModeracaoInput(e.target.value)}
                placeholder="Termos extras separados por vírgula (já tem uma lista padrão fixa)"
                className="w-full px-2.5 py-1.5 border border-ink-300 rounded-md text-xs focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" checked={faqAtiva} onChange={(e) => setFaqAtiva(e.target.checked)} className="w-4 h-4 accent-brand-600" />
                Responder automaticamente perguntas frequentes (por IA)
              </label>
              <button type="button" onClick={handleSalvarModeracao} disabled={savingConfig} className="px-3 py-1.5 bg-brand-600 text-white rounded-lg text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
                {savingConfig ? 'Salvando...' : 'Salvar'}
              </button>
            </div>

            <div className="border-t border-ink-100 pt-3">
              <button type="button" onClick={carregarPerguntas} className="text-xs font-semibold text-ink-600 mb-2">Perguntas frequentes ({perguntas?.length ?? '...'})</button>
              {perguntas && (
                <div className="space-y-2">
                  {perguntas.map((p) => (
                    <div key={p.id} className="flex items-start justify-between gap-2 bg-ink-50 rounded-md px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink-800">{p.pergunta}</p>
                        <p className="text-xs text-ink-500">{p.resposta}</p>
                      </div>
                      <button type="button" onClick={() => handleExcluirPergunta(p.id)} className="text-ink-400 hover:text-red-600 shrink-0" aria-label="Excluir">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5">
                    <input value={novaPergunta} onChange={(e) => setNovaPergunta(e.target.value)} placeholder="Pergunta (ex: Qual o horário de funcionamento?)" className="px-2.5 py-1.5 border border-ink-300 rounded-md text-xs" />
                    <input value={novaResposta} onChange={(e) => setNovaResposta(e.target.value)} placeholder="Resposta automática" className="px-2.5 py-1.5 border border-ink-300 rounded-md text-xs" />
                    <button type="button" onClick={handleCriarPergunta} className="self-start px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">Adicionar</button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-ink-100 pt-3">
              <button type="button" onClick={carregarBloqueados} className="text-xs font-semibold text-ink-600 mb-2">Usuários bloqueados ({totalBloqueados})</button>
              {bloqueados && (
                <div className="space-y-2">
                  {bloqueados.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-2 bg-ink-50 rounded-md px-2.5 py-1.5">
                      <span className="text-xs text-ink-800">@{b.id}{b.motivo ? ` — ${b.motivo}` : ''}</span>
                      <button type="button" onClick={() => handleDesbloquear(b.id)} className="text-xs text-brand-600 hover:text-brand-700 font-medium shrink-0">Desbloquear</button>
                    </div>
                  ))}
                  <div className="flex gap-1.5">
                    <input value={novoBloqueio} onChange={(e) => setNovoBloqueio(e.target.value)} placeholder="@usuário pra bloquear" className="flex-1 px-2.5 py-1.5 border border-ink-300 rounded-md text-xs" />
                    <button type="button" onClick={() => handleBloquear(novoBloqueio)} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-xs font-medium hover:bg-red-700 shrink-0">Bloquear</button>
                  </div>
                  <p className="text-[10px] text-ink-400">O Instagram não tem &quot;bloquear&quot; de verdade pra esse tipo de conta — isso oculta automaticamente os comentários novos desse usuário.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {media.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Nenhuma publicação encontrada.</div>
      ) : media.map((m) => (
        <div key={m.id} className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <button onClick={() => toggleExpand(m.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-ink-50 transition-colors">
            {m.thumbnail_url || m.media_url ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
              <img src={m.thumbnail_url ?? m.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-ink-100 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-900 truncate">{m.caption ?? '(sem legenda)'}</p>
              <p className="text-xs text-ink-500 mt-0.5">{formatDate(m.timestamp)}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-ink-500 shrink-0">
              <MessageCircle className="w-3.5 h-3.5" />
              {m.comments_count ?? 0}
            </div>
          </button>

          {expandedId === m.id && (
            <div className="border-t border-ink-100 p-3 space-y-3 bg-ink-50">
              {loadingComments === m.id && <p className="text-xs text-ink-400 text-center py-4">Carregando comentários...</p>}
              {loadingComments !== m.id && (comments[m.id]?.length ?? 0) === 0 && (
                <p className="text-xs text-ink-400 text-center py-4">Nenhum comentário ainda.</p>
              )}
              {loadingComments !== m.id && (comments[m.id]?.length ?? 0) > 0 && (
                <button
                  type="button"
                  onClick={() => handleClassificar(m.id)}
                  disabled={classificandoMediaId === m.id}
                  className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                >
                  {classificandoMediaId === m.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Classificar sentimento com IA
                </button>
              )}
              {loadingComments !== m.id && comments[m.id]?.map((c) => {
                const jaEhCliente = !!c.username && usernamesClientes?.has(c.username)
                const sentimento = sentimentos[c.id]
                return (
                  <div key={c.id} className="bg-white rounded-lg border border-ink-200 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-ink-900 flex-1">
                        <span className="font-semibold">{c.username ? `@${c.username}` : 'Usuário do Instagram'}</span>{' '}
                        {jaEhCliente && <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-brand-100 text-brand-700 mr-1">já é cliente</span>}
                        {sentimento && <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded mr-1 ${SENTIMENTO_INFO[sentimento].cor}`}>{SENTIMENTO_INFO[sentimento].label}</span>}
                        {c.text}
                      </p>
                    </div>
                    {traducoes[c.id] && <p className="text-xs text-ink-500 italic border-l-2 border-ink-200 pl-2">{traducoes[c.id]}</p>}
                    <div className="flex items-center gap-1 flex-wrap">
                      <button type="button" onClick={() => handleTraduzir(c.id, c.text)} disabled={traduzindoId === c.id} className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100" title="Traduzir">
                        {traduzindoId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => handleOcultar(m.id, c.id, true)} disabled={ocultandoId === c.id} className="p-1.5 text-ink-400 hover:text-amber-600 rounded-lg hover:bg-ink-100" title="Ocultar comentário">
                        {ocultandoId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      {c.username && (
                        <>
                          <button type="button" onClick={() => { setTicketAlvo(c); setTicketAssunto('') }} className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100" title="Transformar em ticket">
                            <TicketIcon className="w-3.5 h-3.5" />
                          </button>
                          {!jaEhCliente && (
                            <button type="button" onClick={() => { setLeadAlvo(c); setLeadNome(c.username ?? '') }} className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100" title="Transformar em lead">
                              <UserPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={async () => {
                              if (!(await confirm(`Bloquear @${c.username}? Comentários novos dele passam a ser ocultados automaticamente.`, { confirmLabel: 'Bloquear' }))) return
                              handleBloquear(c.username!)
                            }}
                            className="p-1.5 text-ink-400 hover:text-red-600 rounded-lg hover:bg-ink-100"
                            title="Bloquear usuário"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRespostasRapidas(c.id)}
                          className="p-1.5 text-ink-400 hover:text-brand-600 rounded-lg hover:bg-ink-100 transition-colors shrink-0"
                          title="Respostas rápidas"
                        >
                          <MessageSquareText className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="text"
                          value={replyText[c.id] ?? ''}
                          onChange={(e) => setReplyText((prev) => ({ ...prev, [c.id]: e.target.value }))}
                          placeholder="Responder..."
                          className="flex-1 px-2.5 py-1.5 border border-ink-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <button
                          onClick={() => handleReply(m.id, c.id)}
                          disabled={replying === c.id || !replyText[c.id]?.trim()}
                          className="p-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors shrink-0"
                        >
                          {replying === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {respostasAbertoPara === c.id && (
                        <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-white border border-ink-200 rounded-lg shadow-lg p-2 space-y-1 max-h-40 overflow-y-auto">
                          {respostasRapidas === null && <p className="text-xs text-ink-400 px-1">Carregando...</p>}
                          {respostasRapidas?.length === 0 && <p className="text-xs text-ink-400 px-1">Nenhuma resposta rápida cadastrada (veja Conversas no WhatsApp).</p>}
                          {respostasRapidas?.map((r) => (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => inserirRespostaRapida(c.id, r.texto)}
                              className="w-full text-left px-2 py-1 rounded hover:bg-ink-50"
                            >
                              <span className="text-[11px] font-semibold text-brand-700">/{r.atalho}</span>{' '}
                              <span className="text-xs text-ink-600">{r.texto}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      ))}

      <Modal open={!!ticketAlvo} onClose={() => setTicketAlvo(null)} title="Transformar em ticket">
        <div className="space-y-3">
          <p className="text-xs text-ink-500">Comentário de @{ticketAlvo?.username}: &quot;{ticketAlvo?.text}&quot;</p>
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
          <p className="text-xs text-ink-500">Comentário de @{leadAlvo?.username}: &quot;{leadAlvo?.text}&quot;</p>
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
