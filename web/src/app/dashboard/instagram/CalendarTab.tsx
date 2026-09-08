'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Lightbulb, PauseCircle, PlayCircle, Copy, CalendarDays, CalendarRange, Download, Grid3x3, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { encontrarConflito } from '@/lib/agendaConflito'
import { datasComemorativasDoDia } from '@/lib/datasComemorativas'

type Status = 'rascunho' | 'agendado' | 'aguardando_confirmacao' | 'enviando' | 'processando' | 'publicado' | 'falhou'

interface PublicacaoCalendario {
  id: string
  tipo: string
  caption?: string
  status: Status
  agendadoPara?: string
  publicadoEm?: string
  dataCriacao: string
  pausado?: boolean
  tema?: string
  mediaItems?: { url: string }[]
}

interface EventoAgenda {
  id: string
  inicio: string
  clienteNome: string
}

// Cor determinística a partir do nome do tema — mesmo tema sempre cai na mesma cor, sem precisar
// de um cadastro/paleta separada (ver item 59: "Temas de semana/mês").
const CORES_TEMA = ['bg-violet-500', 'bg-teal-500', 'bg-orange-500', 'bg-pink-500', 'bg-cyan-500', 'bg-lime-600', 'bg-indigo-500']
function corDoTema(tema: string): string {
  let hash = 0
  for (let i = 0; i < tema.length; i++) hash = (hash * 31 + tema.charCodeAt(i)) >>> 0
  return CORES_TEMA[hash % CORES_TEMA.length]
}

const STATUS_DOT: Record<Status, string> = {
  rascunho: 'bg-ink-300',
  agendado: 'bg-blue-500',
  aguardando_confirmacao: 'bg-purple-500',
  enviando: 'bg-ink-400',
  processando: 'bg-amber-500',
  publicado: 'bg-brand-500',
  falhou: 'bg-red-500',
}

const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  aguardando_confirmacao: 'Aguardando confirmação',
  enviando: 'Enviando',
  processando: 'Processando',
  publicado: 'Publicado',
  falhou: 'Falhou',
}

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

// Data que representa o post no calendário: agendada > publicada > criada — nessa ordem,
// porque um rascunho/agendamento pode ter sido criado num dia e valer pra outro bem diferente.
function dataEfetiva(p: PublicacaoCalendario): Date {
  return new Date(p.agendadoPara ?? p.publicadoEm ?? p.dataCriacao)
}

function chaveDia(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function inicioDaSemana(d: Date): Date {
  const inicio = new Date(d)
  inicio.setHours(0, 0, 0, 0)
  inicio.setDate(inicio.getDate() - inicio.getDay())
  return inicio
}

export default function CalendarTab({ connected }: { connected: boolean }) {
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [loading, setLoading] = useState(true)
  const [publicacoes, setPublicacoes] = useState<PublicacaoCalendario[]>([])
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selecionado, setSelecionado] = useState<PublicacaoCalendario[] | null>(null)
  const [arrastandoId, setArrastandoId] = useState<string | null>(null)
  const [ideiasAbertas, setIdeiasAbertas] = useState(false)
  const [agendandoIdeiaId, setAgendandoIdeiaId] = useState<string | null>(null)
  const [agendandoIdeiaData, setAgendandoIdeiaData] = useState('')
  const [pausarAberto, setPausarAberto] = useState(false)
  const [pausarInicio, setPausarInicio] = useState('')
  const [pausarFim, setPausarFim] = useState('')
  const [processandoAcao, setProcessandoAcao] = useState(false)
  const [modoVisualizacao, setModoVisualizacao] = useState<'mes' | 'semana'>('mes')
  const [semanaAtual, setSemanaAtual] = useState(() => inicioDaSemana(new Date()))
  const [eventosAgenda, setEventosAgenda] = useState<EventoAgenda[]>([])
  const [metaPostsPorSemana, setMetaPostsPorSemana] = useState<number | undefined>(undefined)
  const [metaInput, setMetaInput] = useState('')
  const [editandoMeta, setEditandoMeta] = useState(false)
  const [temaFiltro, setTemaFiltro] = useState('')
  const [feedPreviewAberto, setFeedPreviewAberto] = useState(false)
  const [mediaPublicada, setMediaPublicada] = useState<{ id: string; thumbnail_url?: string; media_url?: string }[] | null>(null)

  function toggleFeedPreview() {
    setFeedPreviewAberto((v) => !v)
    if (mediaPublicada === null) {
      fetch('/api/instagram/media')
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { media?: { id: string; thumbnail_url?: string; media_url?: string }[] } | null) => setMediaPublicada(data?.media ?? []))
        .catch(() => setMediaPublicada([]))
    }
  }

  function carregar() {
    fetch('/api/instagram/publications')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPublicacoes(data.publicacoes ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar publicações'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    carregar()

    // Agenda (WhatsApp) no mesmo calendário — item 54. Se a conta não tiver o módulo de Agenda
    // contratado, a rota simplesmente não devolve nada de útil e essa camada fica vazia, sem erro
    // visível (item opcional, não pode travar o calendário do Instagram por causa disso).
    const de = new Date()
    de.setMonth(de.getMonth() - 1)
    const ate = new Date()
    ate.setMonth(ate.getMonth() + 2)
    fetch(`/api/agenda/agendamentos?de=${de.toISOString()}&ate=${ate.toISOString()}&status=confirmado`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { agendamentos?: EventoAgenda[] } | null) => setEventosAgenda(data?.agendamentos ?? []))
      .catch(() => {})

    fetch('/api/conta/instagram-publish-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { config?: { metaPostsPorSemana?: number } } | null) => {
        setMetaPostsPorSemana(data?.config?.metaPostsPorSemana)
        setMetaInput(data?.config?.metaPostsPorSemana ? String(data.config.metaPostsPorSemana) : '')
      })
      .catch(() => {})
  }, [connected])

  async function handleSalvarMeta() {
    const valor = Number(metaInput)
    // >= 1, não >= 0: uma meta de "0 posts por semana" não é uma meta — e como a UI trata
    // `metaPostsPorSemana` ausente/0 como "sem meta definida" (pra mostrar o botão de configurar),
    // salvar 0 faria a meta sumir silenciosamente da tela mesmo tendo sido "salva" com sucesso.
    if (!metaInput.trim() || !Number.isInteger(valor) || valor < 1) {
      toast.error('Digite um número inteiro de 1 ou mais.')
      return
    }
    try {
      const res = await fetch('/api/conta/instagram-publish-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metaPostsPorSemana: valor }),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setMetaPostsPorSemana(valor)
      setEditandoMeta(false)
      toast.success('Meta salva.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar meta')
    }
  }

  const porDia = useMemo(() => {
    const map = new Map<string, PublicacaoCalendario[]>()
    for (const p of publicacoes) {
      if (p.status === 'rascunho') continue // rascunho sem data vive no "Banco de ideias", não no grid
      if (temaFiltro && p.tema !== temaFiltro) continue
      const key = chaveDia(dataEfetiva(p))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }, [publicacoes, temaFiltro])

  const porDiaAgenda = useMemo(() => {
    const map = new Map<string, EventoAgenda[]>()
    for (const e of eventosAgenda) {
      const key = chaveDia(new Date(e.inicio))
      map.set(key, [...(map.get(key) ?? []), e])
    }
    return map
  }, [eventosAgenda])

  const ideias = useMemo(() => publicacoes.filter((p) => p.status === 'rascunho'), [publicacoes])

  const agendadasParaConflito = useMemo(
    () => publicacoes.filter((p): p is PublicacaoCalendario & { agendadoPara: string } => (p.status === 'agendado' || p.status === 'aguardando_confirmacao') && !!p.agendadoPara),
    [publicacoes],
  )

  const temasDisponiveis = useMemo(
    () => Array.from(new Set(publicacoes.map((p) => p.tema).filter((t): t is string => !!t))).sort(),
    [publicacoes],
  )

  // Meta de frequência (item 56): conta publicado + agendado dentro da semana corrente (dom-sáb).
  const progressoSemana = useMemo(() => {
    const inicio = inicioDaSemana(new Date())
    const fim = new Date(inicio.getTime() + 7 * 86400000)
    const qtd = publicacoes.filter((p) => {
      if (p.status !== 'publicado' && p.status !== 'agendado' && p.status !== 'aguardando_confirmacao') return false
      if (p.pausado) return false // pausado não vai sair essa semana — não conta como progresso da meta
      const quando = dataEfetiva(p)
      return quando >= inicio && quando < fim
    }).length
    return qtd
  }, [publicacoes])

  // Aviso de "nada agendado" (item 60): olha só pra frente (hoje + 3 dias), ignora pausado.
  const semNadaAgendadoProximosDias = useMemo(() => {
    const agora = new Date()
    const limite = new Date(agora.getTime() + 3 * 86400000)
    return !publicacoes.some((p) => {
      if (p.status !== 'agendado' || p.pausado || !p.agendadoPara) return false
      const quando = new Date(p.agendadoPara)
      return quando >= agora && quando <= limite
    })
  }, [publicacoes])

  const diasSemana7 = useMemo(
    () => Array.from({ length: 7 }, (_, i) => { const d = new Date(semanaAtual); d.setDate(d.getDate() + i); return d }),
    [semanaAtual],
  )

  // Preview do feed (item 58): agendamentos futuros (mais próximo primeiro) na frente + posts já
  // publicados de verdade atrás — é assim que o grid do Instagram vai ficar quando os
  // agendamentos saírem. Só usa `mediaItems` (sempre tem URL completa) — a publicação instantânea
  // guarda só o "path" do Blob pras fotos, sem URL pronta pra exibir aqui.
  const feedPreviewAgendado = useMemo(() => {
    return publicacoes
      .filter((p) => p.status === 'agendado' && p.mediaItems?.[0]?.url)
      .sort((a, b) => dataEfetiva(a).getTime() - dataEfetiva(b).getTime())
  }, [publicacoes])

  const dias = useMemo(() => {
    const inicioGrid = new Date(mesAtual)
    inicioGrid.setDate(mesAtual.getDate() - mesAtual.getDay())
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(inicioGrid)
      d.setDate(inicioGrid.getDate() + i)
      return d
    })
  }, [mesAtual])

  function mudarMes(delta: number) {
    setMesAtual((d) => {
      const proximo = new Date(d)
      proximo.setMonth(proximo.getMonth() + delta)
      return proximo
    })
  }

  async function reagendarParaDia(id: string, novoDia: Date) {
    const publicacao = publicacoes.find((p) => p.id === id)
    if (!publicacao?.agendadoPara) return
    const original = new Date(publicacao.agendadoPara)
    const novaData = new Date(novoDia)
    novaData.setHours(original.getHours(), original.getMinutes(), 0, 0)
    if (novaData.getTime() === original.getTime()) return

    const conflito = encontrarConflito(novaData, agendadasParaConflito, { ignorarId: id })
    if (conflito) {
      const ok = await confirm('Já tem outra publicação agendada bem perto desse horário. Mover mesmo assim?', { confirmLabel: 'Mover mesmo assim', danger: false })
      if (!ok) return
    }

    try {
      const res = await fetch(`/api/instagram/publications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendadoPara: novaData.toISOString(), direitosAutoraisConfirmado: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao reagendar')
      toast.success(`Reagendado pra ${novaData.toLocaleDateString('pt-BR')}`)
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reagendar')
    }
  }

  async function handleAgendarIdeia(id: string) {
    if (!agendandoIdeiaData) return
    const ok = await confirm('Confirme que você tem os direitos de uso dessa mídia (imagem, vídeo e áudio) antes de agendar.', {
      confirmLabel: 'Confirmar e agendar',
      danger: false,
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/instagram/publications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agendadoPara: new Date(agendandoIdeiaData).toISOString(), direitosAutoraisConfirmado: true }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao agendar')
      toast.success('Ideia agendada!')
      setAgendandoIdeiaId(null)
      setAgendandoIdeiaData('')
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao agendar')
    }
  }

  async function handlePausarPeriodo(pausado: boolean) {
    if (!pausarInicio || !pausarFim) {
      toast.error('Escolha o início e o fim do período.')
      return
    }
    setProcessandoAcao(true)
    try {
      const res = await fetch('/api/instagram/publications/pausar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio: new Date(pausarInicio).toISOString(), fim: new Date(pausarFim + 'T23:59:59').toISOString(), pausado }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao pausar')
      toast.success(`${json.afetadas} agendamento(s) ${pausado ? 'pausado(s)' : 'retomado(s)'}.`)
      setPausarAberto(false)
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao pausar/retomar')
    } finally {
      setProcessandoAcao(false)
    }
  }

  async function handleDuplicarSemana() {
    const ok = await confirm('Duplicar todos os agendamentos dessa semana pra semana seguinte (+7 dias)?', { confirmLabel: 'Duplicar', danger: false })
    if (!ok) return
    setProcessandoAcao(true)
    try {
      const inicio = inicioDaSemana(mesAtual)
      const res = await fetch('/api/instagram/publications/duplicar-semana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio: inicio.toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao duplicar')
      toast.success(`${json.criadas} publicação(ões) duplicada(s) pra semana seguinte.`)
      if (json.erros?.length) toast.error(`${json.erros.length} falharam (mídia pode ter expirado).`)
      carregar()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao duplicar semana')
    } finally {
      setProcessandoAcao(false)
    }
  }

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; pra ver o calendário.</div>
  }

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => (modoVisualizacao === 'mes' ? mudarMes(-1) : setSemanaAtual((s) => new Date(s.getTime() - 7 * 86400000)))} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-semibold text-ink-800 capitalize">
            {modoVisualizacao === 'mes'
              ? mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
              : `${diasSemana7[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${diasSemana7[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`}
          </h3>
          <button type="button" onClick={() => (modoVisualizacao === 'mes' ? mudarMes(1) : setSemanaAtual((s) => new Date(s.getTime() + 7 * 86400000)))} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Próximo">
            <ChevronRight className="w-5 h-5" />
          </button>
          <div className="flex items-center rounded-lg border border-ink-200 overflow-hidden ml-1">
            <button type="button" onClick={() => setModoVisualizacao('mes')} className={`flex items-center gap-1 px-2 py-1 text-xs font-medium ${modoVisualizacao === 'mes' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}>
              <CalendarDays className="w-3.5 h-3.5" /> Mês
            </button>
            <button type="button" onClick={() => { setSemanaAtual(inicioDaSemana(new Date())); setModoVisualizacao('semana') }} className={`flex items-center gap-1 px-2 py-1 text-xs font-medium ${modoVisualizacao === 'semana' ? 'bg-brand-600 text-white' : 'text-ink-600 hover:bg-ink-50'}`}>
              <CalendarRange className="w-3.5 h-3.5" /> Semana
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {temasDisponiveis.length > 0 && (
            <select value={temaFiltro} onChange={(e) => setTemaFiltro(e.target.value)} className="px-2 py-1.5 border border-ink-200 rounded-lg text-xs text-ink-600">
              <option value="">Todos os temas</option>
              {temasDisponiveis.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          <a href="/api/instagram/calendario/exportar" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100" title="Baixa um arquivo .ics pra importar no Google Calendar (ou Outlook/Apple Calendar)">
            <Download className="w-3.5 h-3.5" /> Exportar
          </a>
          <button type="button" onClick={handleDuplicarSemana} disabled={processandoAcao} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-50" title="Duplica os agendamentos da semana atual (do mês exibido) pra semana seguinte">
            <Copy className="w-3.5 h-3.5" /> Duplicar semana
          </button>
          <button type="button" onClick={() => setPausarAberto((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100">
            <PauseCircle className="w-3.5 h-3.5" /> Pausar período
          </button>
        </div>
      </div>

      {semNadaAgendadoProximosDias && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Nada agendado pros próximos 3 dias — hora de programar alguma coisa.
        </div>
      )}

      <div className="bg-white rounded-xl border border-ink-200 p-3 flex items-center gap-3">
        <span className="text-xs font-medium text-ink-600 shrink-0">Meta da semana</span>
        {editandoMeta ? (
          <>
            <input type="number" min={0} value={metaInput} onChange={(e) => setMetaInput(e.target.value)} className="w-16 px-2 py-1 border border-ink-300 rounded-md text-xs" />
            <button type="button" onClick={handleSalvarMeta} className="text-xs font-medium text-brand-600 hover:text-brand-700">Salvar</button>
            <button type="button" onClick={() => setEditandoMeta(false)} className="text-xs text-ink-400 hover:text-ink-700">Cancelar</button>
          </>
        ) : metaPostsPorSemana ? (
          <>
            <div className="flex-1 h-2 bg-ink-100 rounded-full overflow-hidden max-w-xs">
              <div className={`h-full rounded-full ${progressoSemana >= metaPostsPorSemana ? 'bg-brand-500' : 'bg-blue-400'}`} style={{ width: `${Math.min(100, (progressoSemana / metaPostsPorSemana) * 100)}%` }} />
            </div>
            <span className="text-xs text-ink-500 shrink-0">{progressoSemana} de {metaPostsPorSemana} posts</span>
            <button type="button" onClick={() => setEditandoMeta(true)} className="text-xs text-ink-400 hover:text-brand-700 shrink-0">Editar</button>
          </>
        ) : (
          <button type="button" onClick={() => setEditandoMeta(true)} className="text-xs text-brand-600 hover:text-brand-700">Definir meta de posts por semana</button>
        )}
      </div>

      {pausarAberto && (
        <div className="bg-white rounded-xl border border-ink-200 p-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-ink-500 block">Início</label>
            <input type="date" value={pausarInicio} onChange={(e) => setPausarInicio(e.target.value)} className="px-2.5 py-1.5 border border-ink-300 rounded-md text-xs" />
          </div>
          <div>
            <label className="text-[11px] text-ink-500 block">Fim</label>
            <input type="date" value={pausarFim} onChange={(e) => setPausarFim(e.target.value)} className="px-2.5 py-1.5 border border-ink-300 rounded-md text-xs" />
          </div>
          <button type="button" onClick={() => handlePausarPeriodo(true)} disabled={processandoAcao} className="flex items-center gap-1 px-3 py-1.5 bg-amber-600 text-white rounded-md text-xs font-medium hover:bg-amber-700 disabled:opacity-50">
            <PauseCircle className="w-3.5 h-3.5" /> Pausar
          </button>
          <button type="button" onClick={() => handlePausarPeriodo(false)} disabled={processandoAcao} className="flex items-center gap-1 px-3 py-1.5 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700 disabled:opacity-50">
            <PlayCircle className="w-3.5 h-3.5" /> Retomar
          </button>
          <p className="text-[10px] text-ink-400 w-full">Pausar não cancela nada — só faz o cron pular esses agendamentos até você retomar.</p>
        </div>
      )}

      {modoVisualizacao === 'mes' ? (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-ink-100">
            {DIAS_SEMANA.map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-ink-400">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {dias.map((d) => {
              const key = chaveDia(d)
              const itens = porDia.get(key) ?? []
              const eventosDoDia = porDiaAgenda.get(key) ?? []
              const comemorativas = datasComemorativasDoDia(d)
              const foraDoMes = d.getMonth() !== mesAtual.getMonth()
              const hoje = chaveDia(new Date()) === key
              return (
                <div
                  key={key}
                  onDragOver={(e) => { if (arrastandoId) e.preventDefault() }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = e.dataTransfer.getData('text/plain')
                    setArrastandoId(null)
                    if (id) reagendarParaDia(id, d)
                  }}
                  className={`min-h-20 border-b border-r border-ink-100 p-1.5 text-left align-top last:border-r-0 ${foraDoMes ? 'bg-ink-50 text-ink-300' : ''} ${arrastandoId ? 'hover:bg-brand-50' : ''}`}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => itens.length > 0 && setSelecionado(itens)}
                      disabled={itens.length === 0}
                      className={`text-xs ${hoje ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white font-semibold' : ''}`}
                    >
                      {d.getDate()}
                    </button>
                    {comemorativas.length > 0 && <span title={comemorativas.map((c) => c.nome).join(', ')} className="text-[10px]">🎉</span>}
                    {eventosDoDia.length > 0 && <span title={`${eventosDoDia.length} agendamento(s) na Agenda`} className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  </div>
                  <div className="flex flex-col gap-0.5 mt-1">
                    {itens.slice(0, 3).map((p) => (
                      <span
                        key={p.id}
                        draggable={p.status === 'agendado'}
                        onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setArrastandoId(p.id) }}
                        onDragEnd={() => setArrastandoId(null)}
                        onClick={() => setSelecionado(itens)}
                        title={p.caption || STATUS_LABEL[p.status]}
                        className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-white truncate ${p.tema ? corDoTema(p.tema) : STATUS_DOT[p.status]} ${p.status === 'agendado' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${p.pausado ? 'opacity-50' : ''}`}
                      >
                        {p.caption?.slice(0, 12) || p.tipo}
                      </span>
                    ))}
                    {itens.length > 3 && <span className="text-[9px] text-ink-400">+{itens.length - 3}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden grid grid-cols-7 divide-x divide-ink-100">
          {diasSemana7.map((d) => {
            const key = chaveDia(d)
            const itens = (porDia.get(key) ?? []).sort((a, b) => dataEfetiva(a).getTime() - dataEfetiva(b).getTime())
            const eventosDoDia = porDiaAgenda.get(key) ?? []
            const comemorativas = datasComemorativasDoDia(d)
            const hoje = chaveDia(new Date()) === key
            return (
              <div
                key={key}
                onDragOver={(e) => { if (arrastandoId) e.preventDefault() }}
                onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); setArrastandoId(null); if (id) reagendarParaDia(id, d) }}
                className={`min-h-64 p-2 ${arrastandoId ? 'hover:bg-brand-50' : ''}`}
              >
                <p className={`text-xs font-medium mb-1.5 ${hoje ? 'text-brand-700' : 'text-ink-500'}`}>{DIAS_SEMANA[d.getDay()]} {d.getDate()}</p>
                {comemorativas.map((c) => <p key={c.nome} className="text-[10px] text-amber-600 mb-1">🎉 {c.nome}</p>)}
                {eventosDoDia.map((e) => <p key={e.id} className="text-[10px] text-emerald-700 bg-emerald-50 rounded px-1.5 py-0.5 mb-1 truncate">📅 {e.clienteNome}</p>)}
                <div className="space-y-1">
                  {itens.map((p) => (
                    <div
                      key={p.id}
                      draggable={p.status === 'agendado'}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setArrastandoId(p.id) }}
                      onDragEnd={() => setArrastandoId(null)}
                      onClick={() => setSelecionado([p])}
                      className={`text-[10px] text-white rounded px-1.5 py-1 cursor-pointer ${p.tema ? corDoTema(p.tema) : STATUS_DOT[p.status]} ${p.pausado ? 'opacity-50' : ''}`}
                    >
                      <p className="font-medium">{p.agendadoPara ? new Date(p.agendadoPara).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : STATUS_LABEL[p.status]}</p>
                      <p className="truncate opacity-90">{p.caption || p.tipo}</p>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
      <p className="text-[11px] text-ink-400">Arraste um post <strong>agendado</strong> (não pausado) pra outro dia pra reagendar — mantém o mesmo horário, só muda a data.</p>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_LABEL[s]}</span>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-ink-200">
        <button type="button" onClick={() => setIdeiasAbertas((v) => !v)} className="w-full flex items-center gap-2 p-3 text-sm font-semibold text-ink-800">
          <Lightbulb className="w-4 h-4 text-amber-500" /> Banco de ideias ({ideias.length}) — rascunhos sem data
        </button>
        {ideiasAbertas && (
          <div className="border-t border-ink-100 divide-y divide-ink-100">
            {ideias.length === 0 ? (
              <p className="p-3 text-xs text-ink-400">Nenhuma ideia salva ainda — salve um rascunho sem agendar na aba Publicar pra ela aparecer aqui.</p>
            ) : (
              ideias.map((idea) => (
                <div key={idea.id} className="p-3 flex items-center gap-2">
                  <p className="flex-1 text-sm text-ink-700 truncate">{idea.caption || `(${idea.tipo}, sem legenda)`}</p>
                  {agendandoIdeiaId === idea.id ? (
                    <>
                      <input
                        type="datetime-local"
                        value={agendandoIdeiaData}
                        onChange={(e) => setAgendandoIdeiaData(e.target.value)}
                        className="px-2 py-1 border border-ink-300 rounded-md text-xs"
                      />
                      <button type="button" onClick={() => handleAgendarIdeia(idea.id)} className="px-2.5 py-1 bg-brand-600 text-white rounded-md text-xs font-medium hover:bg-brand-700">Confirmar</button>
                      <button type="button" onClick={() => setAgendandoIdeiaId(null)} className="text-xs text-ink-500 hover:text-ink-800">Cancelar</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setAgendandoIdeiaId(idea.id)} className="px-2.5 py-1 text-xs font-medium text-brand-600 hover:text-brand-700">Agendar</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-ink-200">
        <button type="button" onClick={toggleFeedPreview} className="w-full flex items-center gap-2 p-3 text-sm font-semibold text-ink-800">
          <Grid3x3 className="w-4 h-4 text-brand-500" /> Preview do feed — como o grid vai ficar
        </button>
        {feedPreviewAberto && (
          <div className="border-t border-ink-100 p-3">
            {mediaPublicada === null ? (
              <p className="text-xs text-ink-400">Carregando...</p>
            ) : feedPreviewAgendado.length === 0 && mediaPublicada.length === 0 ? (
              <p className="text-xs text-ink-400">Nenhuma publicação (agendada ou já publicada) com mídia disponível pra prever ainda.</p>
            ) : (
              <>
                <p className="text-[11px] text-ink-400 mb-2">Os primeiros (com contorno azul) são os agendamentos futuros — mostram como vão entrar no topo do seu feed quando saírem.</p>
                <div className="grid grid-cols-3 gap-1">
                  {feedPreviewAgendado.map((p) => (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem vinda do Vercel Blob, sem domínio fixo pra configurar no next/image
                    <img key={p.id} src={p.mediaItems![0].url} alt="" className="aspect-square object-cover rounded ring-2 ring-blue-400" title={`Agendado: ${p.caption ?? p.tipo}`} />
                  ))}
                  {mediaPublicada.slice(0, Math.max(0, 9 - feedPreviewAgendado.length)).map((m) => (
                    // eslint-disable-next-line @next/next/no-img-element -- imagem vinda da CDN da Meta, sem domínio fixo pra configurar no next/image
                    <img key={m.id} src={m.thumbnail_url ?? m.media_url} alt="" className="aspect-square object-cover rounded" />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {selecionado && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={() => setSelecionado(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-ink-800">Publicações do dia</h4>
              <button type="button" onClick={() => setSelecionado(null)} className="text-ink-400 hover:text-ink-700" aria-label="Fechar">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {selecionado.map((p) => (
                <div key={p.id} className="border border-ink-200 rounded-lg p-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full ${STATUS_DOT[p.status]}`} />
                    <span className="text-xs font-medium text-ink-700">{STATUS_LABEL[p.status]}</span>
                    {p.pausado && <span className="text-[10px] px-1.5 py-0.5 rounded bg-ink-200 text-ink-600">Pausado</span>}
                    {p.tema && <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${corDoTema(p.tema)}`}>{p.tema}</span>}
                    <span className="text-[11px] text-ink-400 ml-auto">{p.tipo}</span>
                  </div>
                  <p className="text-xs text-ink-600">{p.caption || '(sem legenda)'}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-ink-400">Pra editar um rascunho ou agendamento, use a aba Publicar.</p>
          </div>
        </div>
      )}
      {ConfirmDialogElement}
    </div>
  )
}
