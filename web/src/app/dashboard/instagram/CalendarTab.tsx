'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

type Status = 'rascunho' | 'agendado' | 'enviando' | 'processando' | 'publicado' | 'falhou'

interface PublicacaoCalendario {
  id: string
  tipo: string
  caption?: string
  status: Status
  agendadoPara?: string
  publicadoEm?: string
  dataCriacao: string
}

const STATUS_DOT: Record<Status, string> = {
  rascunho: 'bg-ink-300',
  agendado: 'bg-blue-500',
  enviando: 'bg-ink-400',
  processando: 'bg-amber-500',
  publicado: 'bg-brand-500',
  falhou: 'bg-red-500',
}

const STATUS_LABEL: Record<Status, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
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

export default function CalendarTab({ connected }: { connected: boolean }) {
  const [loading, setLoading] = useState(true)
  const [publicacoes, setPublicacoes] = useState<PublicacaoCalendario[]>([])
  const [mesAtual, setMesAtual] = useState(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  const [selecionado, setSelecionado] = useState<PublicacaoCalendario[] | null>(null)

  useEffect(() => {
    if (!connected) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- estado derivado de uma prop, mesmo padrão usado nas demais abas
      setLoading(false)
      return
    }
    fetch('/api/instagram/publications')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error)
        setPublicacoes(data.publicacoes ?? [])
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : 'Erro ao carregar publicações'))
      .finally(() => setLoading(false))
  }, [connected])

  const porDia = useMemo(() => {
    const map = new Map<string, PublicacaoCalendario[]>()
    for (const p of publicacoes) {
      const key = chaveDia(dataEfetiva(p))
      map.set(key, [...(map.get(key) ?? []), p])
    }
    return map
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

  if (!connected) {
    return <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">Conecte sua conta do Instagram na aba &quot;Visão geral&quot; pra ver o calendário.</div>
  }

  if (loading) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => mudarMes(-1)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Mês anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-sm font-semibold text-ink-800 capitalize">{mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <button type="button" onClick={() => mudarMes(1)} className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-500" aria-label="Próximo mês">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

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
              <button
                key={key}
                type="button"
                onClick={() => itens.length > 0 && setSelecionado(itens)}
                disabled={itens.length === 0}
                className={`min-h-20 border-b border-r border-ink-100 p-1.5 text-left align-top last:border-r-0 ${
                  foraDoMes ? 'bg-ink-50 text-ink-300' : itens.length > 0 ? 'hover:bg-ink-50 cursor-pointer' : 'cursor-default'
                }`}
              >
                <p className={`text-xs ${hoje ? 'inline-flex items-center justify-center w-5 h-5 rounded-full bg-brand-600 text-white font-semibold' : ''}`}>{d.getDate()}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {itens.slice(0, 4).map((p) => (
                    <span key={p.id} className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[p.status]}`} />
                  ))}
                  {itens.length > 4 && <span className="text-[9px] text-ink-400">+{itens.length - 4}</span>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
        {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${STATUS_DOT[s]}`} /> {STATUS_LABEL[s]}</span>
        ))}
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
    </div>
  )
}
