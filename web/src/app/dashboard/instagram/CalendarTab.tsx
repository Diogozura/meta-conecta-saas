'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X, Lightbulb, PauseCircle, PlayCircle, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { encontrarConflito } from '@/lib/agendaConflito'

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
  }, [connected])

  const porDia = useMemo(() => {
    const map = new Map<string, PublicacaoCalendario[]>()
    for (const p of publicacoes) {
      if (p.status === 'rascunho') continue // rascunho sem data vive no "Banco de ideias", não no grid
      const key = chaveDia(dataEfetiva(p))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
  }, [publicacoes])

  const ideias = useMemo(() => publicacoes.filter((p) => p.status === 'rascunho'), [publicacoes])

  const agendadasParaConflito = useMemo(
    () => publicacoes.filter((p): p is PublicacaoCalendario & { agendadoPara: string } => (p.status === 'agendado' || p.status === 'aguardando_confirmacao') && !!p.agendadoPara),
    [publicacoes],
  )

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
          <button type="button" onClick={() => mudarMes(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Mês anterior">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-semibold text-ink-800 capitalize">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
          <button type="button" onClick={() => mudarMes(1)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Próximo mês">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={handleDuplicarSemana} disabled={processandoAcao} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100 disabled:opacity-50" title="Duplica os agendamentos da semana atual (do mês exibido) pra semana seguinte">
            <Copy className="w-3.5 h-3.5" /> Duplicar semana
          </button>
          <button type="button" onClick={() => setPausarAberto((v) => !v)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-ink-600 hover:bg-ink-100">
            <PauseCircle className="w-3.5 h-3.5" /> Pausar período
          </button>
        </div>
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
                <button
                  type="button"
                  onClick={() => itens.length > 0 && setSelecionado(itens)}
                  disabled={itens.length === 0}
                  className={`text-xs ${hoje ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white font-semibold' : ''}`}
                >
                  {d.getDate()}
                </button>
                <div className="flex flex-col gap-0.5 mt-1">
                  {itens.slice(0, 3).map((p) => (
                    <span
                      key={p.id}
                      draggable={p.status === 'agendado'}
                      onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setArrastandoId(p.id) }}
                      onDragEnd={() => setArrastandoId(null)}
                      onClick={() => setSelecionado(itens)}
                      title={p.caption || STATUS_LABEL[p.status]}
                      className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] text-white truncate ${STATUS_DOT[p.status]} ${p.status === 'agendado' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${p.pausado ? 'opacity-50' : ''}`}
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
