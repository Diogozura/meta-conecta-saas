'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, Plus, Search, X, UserCheck, UserMinus } from 'lucide-react'
import { Skeleton } from '@/components/Skeleton'
import { Modal } from '@/components/Modal'

type TicketStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
type TicketPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente'

type TicketApi = {
  id: string
  numero: string
  assunto: string
  descricao?: string
  protocolo: string
  status: TicketStatus
  prioridade: TicketPrioridade
  criadoEm: string
  atualizadoEm: string
  atendenteId?: string | null
  atendenteNome?: string | null
}

const STATUS_INFO: Record<TicketStatus, { label: string; cor: string }> = {
  aberto: { label: 'Aberto', cor: 'bg-blue-100 text-blue-700' },
  em_andamento: { label: 'Em andamento', cor: 'bg-amber-100 text-amber-700' },
  resolvido: { label: 'Resolvido', cor: 'bg-emerald-100 text-emerald-700' },
  fechado: { label: 'Fechado', cor: 'bg-ink-100 text-ink-500' },
}

const PRIORIDADE_INFO: Record<TicketPrioridade, { label: string; cor: string }> = {
  baixa: { label: 'Baixa', cor: 'bg-ink-100 text-ink-500' },
  normal: { label: 'Normal', cor: 'bg-ink-100 text-ink-600' },
  alta: { label: 'Alta', cor: 'bg-amber-100 text-amber-700' },
  urgente: { label: 'Urgente', cor: 'bg-red-100 text-red-700' },
}

const ABAS: { value: TicketStatus | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_andamento', label: 'Em andamento' },
  { value: 'resolvido', label: 'Resolvido' },
  { value: 'fechado', label: 'Fechado' },
]

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketApi[] | null>(null)
  const [aba, setAba] = useState<TicketStatus | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [ticketSelecionado, setTicketSelecionado] = useState<TicketApi | null>(null)

  function carregar() {
    fetch('/api/tickets')
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tickets: TicketApi[] }) => setTickets(data.tickets))
      .catch(() => toast.error('Erro ao carregar os tickets'))
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtrados = useMemo(() => {
    const buscaNormalizada = busca.trim().toLowerCase()
    return (tickets ?? []).filter((t) => {
      if (aba !== 'todos' && t.status !== aba) return false
      if (!buscaNormalizada) return true
      return (
        t.protocolo.toLowerCase().includes(buscaNormalizada) ||
        t.numero.includes(buscaNormalizada) ||
        t.assunto.toLowerCase().includes(buscaNormalizada)
      )
    })
  }, [tickets, aba, busca])

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-ink-100 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-ink-900">Tickets</h1>
          <p className="text-sm text-ink-500 mt-0.5">Chamados de suporte — um cliente pode ter vários ao longo do tempo.</p>
        </div>
        <button
          onClick={() => setNovoAberto(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" />
          Novo ticket
        </button>
      </div>

      <div className="flex items-center gap-3 flex-wrap px-6 py-3 border-b border-ink-100 shrink-0">
        <div className="flex items-center gap-1 bg-ink-100 rounded-lg p-1">
          {ABAS.map((a) => (
            <button
              key={a.value}
              onClick={() => setAba(a.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                aba === a.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-700'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full max-w-xs">
          <Search className="w-4 h-4 text-ink-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por protocolo, número ou assunto..."
            className="w-full pl-9 pr-3 py-2 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tickets === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : filtrados.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-12">Nenhum ticket encontrado.</p>
        ) : (
          <div className="border border-ink-200 rounded-xl divide-y divide-ink-100 bg-white">
            {filtrados.map((t) => (
              <button
                key={t.id}
                onClick={() => setTicketSelecionado(t)}
                className="w-full text-left px-4 py-3 flex items-center gap-4 hover:bg-ink-50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-ink-400">#{t.protocolo}</span>
                    <p className="text-sm font-semibold text-ink-900 truncate">{t.assunto}</p>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">{t.numero}{t.atendenteNome ? ` · ${t.atendenteNome}` : ''}</p>
                </div>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${PRIORIDADE_INFO[t.prioridade].cor}`}>
                  {PRIORIDADE_INFO[t.prioridade].label}
                </span>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-full shrink-0 ${STATUS_INFO[t.status].cor}`}>
                  {STATUS_INFO[t.status].label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <NovoTicketModal
        open={novoAberto}
        onClose={() => setNovoAberto(false)}
        onCriado={(t) => {
          setTickets((prev) => [t, ...(prev ?? [])])
          setNovoAberto(false)
        }}
      />

      <DetalheTicketModal
        ticket={ticketSelecionado}
        onClose={() => setTicketSelecionado(null)}
        onAtualizado={(t) => {
          setTickets((prev) => prev?.map((item) => (item.id === t.id ? t : item)) ?? null)
          setTicketSelecionado(t)
        }}
      />
    </div>
  )
}

function NovoTicketModal({ open, onClose, onCriado }: { open: boolean; onClose: () => void; onCriado: (t: TicketApi) => void }) {
  const [numero, setNumero] = useState('')
  const [assunto, setAssunto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<TicketPrioridade>('normal')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    setNumero('')
    setAssunto('')
    setDescricao('')
    setPrioridade('normal')
  }, [open])

  async function salvar() {
    if (!numero.trim() || !assunto.trim()) {
      toast.error('Número e assunto são obrigatórios.')
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numero: numero.trim(), assunto: assunto.trim(), descricao: descricao.trim() || undefined, prioridade }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar ticket')
      toast.success('Ticket aberto.')
      onCriado(json.ticket)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar ticket')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo ticket" widthClass="max-w-md">
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Número do cliente (WhatsApp)</label>
          <input
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex: 5511999999999"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Assunto</label>
          <input
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Ex: Internet lenta"
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Descrição (opcional)</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Prioridade</label>
          <select
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as TicketPrioridade)}
            className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm"
          >
            {(Object.keys(PRIORIDADE_INFO) as TicketPrioridade[]).map((p) => (
              <option key={p} value={p}>{PRIORIDADE_INFO[p].label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-ink-100">
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100 rounded-lg">
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          onClick={salvar}
          disabled={salvando}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg disabled:opacity-50"
        >
          {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
          Abrir ticket
        </button>
      </div>
    </Modal>
  )
}

function DetalheTicketModal({
  ticket,
  onClose,
  onAtualizado,
}: {
  ticket: TicketApi | null
  onClose: () => void
  onAtualizado: (t: TicketApi) => void
}) {
  const [salvando, setSalvando] = useState<'status' | 'prioridade' | 'atendente' | null>(null)

  async function atualizar(patch: Record<string, unknown>, tipo: 'status' | 'prioridade') {
    if (!ticket) return
    setSalvando(tipo)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error()
      onAtualizado({ ...ticket, ...patch } as TicketApi)
      toast.success('Ticket atualizado.')
    } catch {
      toast.error('Erro ao atualizar — tente de novo')
    } finally {
      setSalvando(null)
    }
  }

  async function assumirOuLiberar(acao: 'assumir' | 'liberar') {
    if (!ticket) return
    setSalvando('atendente')
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/${acao}`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const json = await res.json().catch(() => ({}))
      toast.success(acao === 'assumir' ? 'Ticket assumido.' : 'Ticket liberado.')
      onAtualizado({
        ...ticket,
        atendenteId: acao === 'assumir' ? (json.atendenteId ?? ticket.atendenteId) : null,
        atendenteNome: acao === 'assumir' ? (json.atendenteNome ?? ticket.atendenteNome) : null,
        status: acao === 'assumir' ? 'em_andamento' : ticket.status,
      })
    } catch {
      toast.error('Erro ao atualizar — tente de novo')
    } finally {
      setSalvando(null)
    }
  }

  if (!ticket) return null

  return (
    <Modal open={!!ticket} onClose={onClose} title={`#${ticket.protocolo}`} widthClass="max-w-lg">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-ink-900">{ticket.assunto}</p>
          <Link href={`/dashboard/conversas?from=${encodeURIComponent(ticket.numero)}`} className="text-xs text-brand-700 hover:underline">
            {ticket.numero} — abrir conversa
          </Link>
          {ticket.descricao && <p className="text-sm text-ink-600 mt-2 whitespace-pre-wrap">{ticket.descricao}</p>}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Status</label>
            <select
              value={ticket.status}
              disabled={salvando === 'status'}
              onChange={(e) => atualizar({ status: e.target.value }, 'status')}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm disabled:opacity-50"
            >
              {(Object.keys(STATUS_INFO) as TicketStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_INFO[s].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Prioridade</label>
            <select
              value={ticket.prioridade}
              disabled={salvando === 'prioridade'}
              onChange={(e) => atualizar({ prioridade: e.target.value }, 'prioridade')}
              className="w-full px-3 py-2 border border-ink-300 rounded-lg text-sm disabled:opacity-50"
            >
              {(Object.keys(PRIORIDADE_INFO) as TicketPrioridade[]).map((p) => (
                <option key={p} value={p}>{PRIORIDADE_INFO[p].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-3">
          <p className="text-xs text-ink-500">
            {ticket.atendenteNome ? `Atendente: ${ticket.atendenteNome}` : 'Sem atendente'}
          </p>
          {ticket.atendenteId ? (
            <button
              onClick={() => assumirOuLiberar('liberar')}
              disabled={salvando === 'atendente'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-ink-600 border border-ink-300 rounded-lg hover:bg-ink-50 disabled:opacity-50"
            >
              <UserMinus className="w-3.5 h-3.5" />
              Liberar
            </button>
          ) : (
            <button
              onClick={() => assumirOuLiberar('assumir')}
              disabled={salvando === 'atendente'}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-700 border border-brand-300 bg-brand-50 rounded-lg hover:bg-brand-100 disabled:opacity-50"
            >
              <UserCheck className="w-3.5 h-3.5" />
              Assumir
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}
