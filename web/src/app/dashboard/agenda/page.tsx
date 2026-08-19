'use client'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, Plus, Trash2, Link2, CheckCircle2, X, Pencil, Check } from 'lucide-react'
import { AgendaCalendar, toDateKey, type DayMark } from '@/components/agenda/AgendaCalendar'
import { Skeleton } from '@/components/Skeleton'
import { useConfirmDialog } from '@/components/ConfirmDialog'
import { Modal } from '@/components/Modal'

type Profissional = {
  id: string
  nome: string
  telefone?: string
  ativo: boolean
  google?: { conectado: boolean; email?: string }
}

type Servico = {
  id: string
  nome: string
  duracaoMinutos: number
  profissionalIds?: string[]
  ativo: boolean
}

type Disponibilidade = {
  id: string
  profissionalId: string
  inicio: string
  fim: string
}

type Agendamento = {
  id: string
  profissionalId: string
  servicoId: string
  clienteNome: string
  clienteTelefone: string
  inicio: string
  fim: string
  status: 'confirmado' | 'cancelado' | 'concluido'
}

type TabKey = 'profissionais' | 'servicos' | 'disponibilidade' | 'agendamentos'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'profissionais', label: 'Profissionais' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'disponibilidade', label: 'Disponibilidade' },
  { key: 'agendamentos', label: 'Agendamentos' },
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function toDateInputValue(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function toTimeInputValue(iso: string) {
  const d = new Date(iso)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function startOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toISOString()
}

function endOfDayISO(dateStr: string) {
  return new Date(`${dateStr}T23:59:59`).toISOString()
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new Error(data?.error ?? `Erro ao carregar dados (${res.status})`)
  return data as T
}

export default function AgendaPage() {
  return (
    <Suspense>
      <AgendaInner />
    </Suspense>
  )
}

function AgendaInner() {
  const [activeTab, setActiveTab] = useState<TabKey>('profissionais')
  const [profissionais, setProfissionais] = useState<Profissional[]>([])
  const [servicos, setServicos] = useState<Servico[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const router = useRouter()

  const carregarBase = useCallback(async () => {
    try {
      const [prof, serv] = await Promise.all([
        fetchJson<{ profissionais: Profissional[] }>('/api/agenda/profissionais'),
        fetchJson<{ servicos: Servico[] }>('/api/agenda/servicos'),
      ])
      setProfissionais(prof.profissionais)
      setServicos(serv.servicos)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    carregarBase()
  }, [carregarBase])

  // Feedback do callback OAuth do Google (/api/agenda/google/callback)
  useEffect(() => {
    const google = searchParams.get('google')
    if (!google) return
    if (google === 'conectado') {
      toast.success('Google Calendar conectado com sucesso.')
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
      carregarBase()
    } else if (google === 'erro') {
      toast.error('Não foi possível conectar o Google Calendar. Tente novamente.')
    } else if (google === 'nao_autenticado') {
      toast.error('Sessão expirada — faça login novamente antes de conectar o Google.')
    }
    router.replace('/dashboard/agenda')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calendar className="w-5 h-5 text-brand-600" />
        <h1 className="text-lg font-bold text-ink-900">Agenda</h1>
      </div>

      <div data-tour="agenda-tabs" className="border-b border-ink-200 flex gap-1 overflow-x-auto overflow-y-hidden scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap shrink-0 transition-colors ${
              activeTab === tab.key
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-ink-500 hover:text-ink-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AgendaListSkeleton />
      ) : (
        <>
          {activeTab === 'profissionais' && (
            <ProfissionaisTab profissionais={profissionais} onChanged={carregarBase} />
          )}
          {activeTab === 'servicos' && (
            <ServicosTab servicos={servicos} profissionais={profissionais} onChanged={carregarBase} />
          )}
          {activeTab === 'disponibilidade' && <DisponibilidadeTab profissionais={profissionais} />}
          {activeTab === 'agendamentos' && <AgendamentosTab profissionais={profissionais} servicos={servicos} />}
        </>
      )}
    </div>
  )
}

function AgendaListSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-4 w-4" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ListRowSkeleton() {
  return (
    <div className="px-4 py-3 flex items-center justify-between">
      <div className="space-y-1.5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
  )
}

/* ─── Profissionais ──────────────────────────────────────────────────────── */

function ProfissionaisTab({ profissionais, onChanged }: { profissionais: Profissional[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editTelefone, setEditTelefone] = useState('')
  const [editAtivo, setEditAtivo] = useState(true)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!nome.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/agenda/profissionais', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), telefone: telefone.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar profissional')
      toast.success('Profissional criado.')
      setNome('')
      setTelefone('')
      setShowForm(false)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar profissional')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(p: Profissional) {
    setEditingId(p.id)
    setEditNome(p.nome)
    setEditTelefone(p.telefone ?? '')
    setEditAtivo(p.ativo)
  }

  async function handleSaveEdit(id: string) {
    if (!editNome.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/agenda/profissionais/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: editNome.trim(), telefone: editTelefone.trim() || undefined, ativo: editAtivo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar profissional')
      toast.success('Profissional atualizado.')
      setEditingId(null)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar profissional')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Remover este profissional? Isso não cancela agendamentos já criados.'))) return
    try {
      const res = await fetch(`/api/agenda/profissionais/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover profissional')
      toast.success('Profissional removido.')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover profissional')
    }
  }

  return (
    <div className="space-y-3">
      {ConfirmDialogElement}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
      >
        {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        Novo profissional
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 bg-white p-3 rounded-xl border border-ink-200">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Nome</label>
            <input value={nome} onChange={(e) => setNome(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Telefone (opcional)</label>
            <input value={telefone} onChange={(e) => setTelefone(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
          </div>
          <button type="submit" disabled={saving} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
        {profissionais.length === 0 && <p className="p-6 text-center text-sm text-ink-400">Nenhum profissional cadastrado ainda.</p>}
        {profissionais.map((p) => (
          <div key={p.id} className="px-4 py-3">
            {editingId === p.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Nome</label>
                  <input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Telefone</label>
                  <input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-ink-600 pb-2">
                  <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} /> Ativo
                </label>
                <button onClick={() => handleSaveEdit(p.id)} disabled={saving} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Salvar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-ink-400 hover:bg-ink-50 rounded-lg transition-colors" title="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 break-words">{p.nome}{!p.ativo && <span className="ml-2 text-[10px] text-ink-400 font-normal">inativo</span>}</p>
                  <p className="text-xs text-ink-500">{p.telefone || 'sem telefone'}</p>
                </div>
                <div className="flex items-center flex-wrap gap-2">
                  {p.google?.conectado ? (
                    <>
                      <span className="flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-1 rounded-full break-all">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Google conectado{p.google.email ? ` (${p.google.email})` : ''}
                      </span>
                      <a
                        href={`/api/agenda/profissionais/${p.id}/google/connect`}
                        title="Reconectar ou trocar de conta Google"
                        className="flex items-center gap-1 text-xs text-ink-500 bg-ink-50 px-2 py-1 rounded-full hover:bg-ink-100 transition-colors"
                      >
                        <Link2 className="w-3.5 h-3.5" /> Trocar conta
                      </a>
                    </>
                  ) : (
                    <a
                      href={`/api/agenda/profissionais/${p.id}/google/connect`}
                      className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Conectar Google Calendar
                    </a>
                  )}
                  <button onClick={() => startEdit(p)} className="p-1.5 text-ink-400 hover:text-brand-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-ink-400 hover:text-red-600 transition-colors" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Serviços ───────────────────────────────────────────────────────────── */

function ServicosTab({ servicos, profissionais, onChanged }: { servicos: Servico[]; profissionais: Profissional[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [duracao, setDuracao] = useState('30')
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')
  const [editDuracao, setEditDuracao] = useState('30')
  const [editSelecionados, setEditSelecionados] = useState<string[]>([])
  const [editAtivo, setEditAtivo] = useState(true)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  function toggleProfissional(id: string) {
    setSelecionados((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function toggleEditProfissional(id: string) {
    setEditSelecionados((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  }

  function startEdit(s: Servico) {
    setEditingId(s.id)
    setEditNome(s.nome)
    setEditDuracao(String(s.duracaoMinutos))
    setEditSelecionados(s.profissionalIds ?? [])
    setEditAtivo(s.ativo)
  }

  async function handleSaveEdit(id: string) {
    const duracaoMinutos = parseInt(editDuracao, 10)
    if (!editNome.trim() || !duracaoMinutos || duracaoMinutos <= 0) return
    setSaving(true)
    try {
      const res = await fetch(`/api/agenda/servicos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: editNome.trim(),
          duracaoMinutos,
          profissionalIds: editSelecionados.length ? editSelecionados : [],
          ativo: editAtivo,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar serviço')
      toast.success('Serviço atualizado.')
      setEditingId(null)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar serviço')
    } finally {
      setSaving(false)
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const duracaoMinutos = parseInt(duracao, 10)
    if (!nome.trim() || !duracaoMinutos || duracaoMinutos <= 0) return
    setSaving(true)
    try {
      const res = await fetch('/api/agenda/servicos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), duracaoMinutos, profissionalIds: selecionados.length ? selecionados : undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao criar serviço')
      toast.success('Serviço criado.')
      setNome('')
      setDuracao('30')
      setSelecionados([])
      setShowForm(false)
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar serviço')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Remover este serviço?'))) return
    try {
      const res = await fetch(`/api/agenda/servicos/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao remover serviço')
      toast.success('Serviço removido.')
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover serviço')
    }
  }

  return (
    <div className="space-y-3">
      {ConfirmDialogElement}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
      >
        {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
        Novo serviço
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="space-y-3 bg-white p-3 rounded-xl border border-ink-200">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Nome</label>
              <input value={nome} onChange={(e) => setNome(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Duração (minutos)</label>
              <input type="number" min={5} step={5} value={duracao} onChange={(e) => setDuracao(e.target.value)} required className="w-24 px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <button type="submit" disabled={saving} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
          {profissionais.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Quem atende esse serviço (vazio = todos)</label>
              <div className="flex flex-wrap gap-2">
                {profissionais.map((p) => (
                  <label key={p.id} className="flex items-center gap-1.5 text-xs bg-ink-50 border border-ink-200 rounded-lg px-2 py-1 cursor-pointer">
                    <input type="checkbox" checked={selecionados.includes(p.id)} onChange={() => toggleProfissional(p.id)} />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
        </form>
      )}

      <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
        {servicos.length === 0 && <p className="p-6 text-center text-sm text-ink-400">Nenhum serviço cadastrado ainda.</p>}
        {servicos.map((s) => (
          <div key={s.id} className="px-4 py-3">
            {editingId === s.id ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Nome</label>
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Duração (minutos)</label>
                    <input type="number" min={5} step={5} value={editDuracao} onChange={(e) => setEditDuracao(e.target.value)} className="w-24 px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-ink-600 pb-2">
                    <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} /> Ativo
                  </label>
                  <button onClick={() => handleSaveEdit(s.id)} disabled={saving} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Salvar">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-ink-400 hover:bg-ink-50 rounded-lg transition-colors" title="Cancelar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {profissionais.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-ink-600 mb-1">Quem atende esse serviço (vazio = todos)</label>
                    <div className="flex flex-wrap gap-2">
                      {profissionais.map((p) => (
                        <label key={p.id} className="flex items-center gap-1.5 text-xs bg-ink-50 border border-ink-200 rounded-lg px-2 py-1 cursor-pointer">
                          <input type="checkbox" checked={editSelecionados.includes(p.id)} onChange={() => toggleEditProfissional(p.id)} />
                          {p.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-900 break-words">{s.nome}{!s.ativo && <span className="ml-2 text-[10px] text-ink-400 font-normal">inativo</span>}</p>
                  <p className="text-xs text-ink-500 break-words">
                    {s.duracaoMinutos} min
                    {s.profissionalIds?.length ? ` · ${s.profissionalIds.map((id) => profissionais.find((p) => p.id === id)?.nome ?? id).join(', ')}` : ' · qualquer profissional'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-ink-400 hover:text-brand-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-ink-400 hover:text-red-600 transition-colors" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── Disponibilidade ────────────────────────────────────────────────────── */

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

function DisponibilidadeTab({ profissionais }: { profissionais: Profissional[] }) {
  const [profissionalId, setProfissionalId] = useState(profissionais[0]?.id ?? '')
  const [blocos, setBlocos] = useState<Disponibilidade[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState('')
  const [editHoraInicio, setEditHoraInicio] = useState('')
  const [editHoraFim, setEditHoraFim] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  // horário avulso no dia selecionado
  const [avulsoInicio, setAvulsoInicio] = useState('09:00')
  const [avulsoFim, setAvulsoFim] = useState('18:00')

  // navegação da lista "Próximos dias" agrupada por mês + seleção múltipla de dias
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null)
  const [diasSelecionados, setDiasSelecionados] = useState<Set<string>>(new Set())
  const [bulkEditando, setBulkEditando] = useState(false)
  const [bulkHoraInicio, setBulkHoraInicio] = useState('09:00')
  const [bulkHoraFim, setBulkHoraFim] = useState('18:00')
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  // programar vários dias de uma vez (padrão semanal + período)
  const [diasSemana, setDiasSemana] = useState<boolean[]>([false, true, true, true, true, true, false])
  const [rangeDe, setRangeDe] = useState(() => toDateKey(new Date()))
  const [rangeAte, setRangeAte] = useState(() => toDateKey(new Date(Date.now() + 29 * 24 * 60 * 60 * 1000)))
  const [padraoInicio, setPadraoInicio] = useState('09:00')
  const [padraoFim, setPadraoFim] = useState('18:00')
  const [applying, setApplying] = useState<'aplicar' | 'remover' | null>(null)

  const carregar = useCallback(async () => {
    if (!profissionalId) {
      setBlocos([])
      return
    }
    setLoading(true)
    try {
      const de = new Date()
      const ate = new Date(de.getTime() + 120 * 24 * 60 * 60 * 1000)
      const res = await fetchJson<{ disponibilidades: Disponibilidade[] }>(
        `/api/agenda/disponibilidades?profissionalId=${profissionalId}&de=${de.toISOString()}&ate=${ate.toISOString()}`
      )
      setBlocos(res.disponibilidades)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar disponibilidade')
    } finally {
      setLoading(false)
    }
  }, [profissionalId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    carregar()
  }, [carregar])

  function toggleDiaSemana(i: number) {
    setDiasSemana((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
  }

  function diasNoPeriodo(): Date[] {
    if (!rangeDe || !rangeAte) return []
    const de = new Date(`${rangeDe}T00:00:00`)
    const ate = new Date(`${rangeAte}T00:00:00`)
    if (ate < de) return []
    const dias: Date[] = []
    for (let d = new Date(de); d <= ate; d.setDate(d.getDate() + 1)) {
      if (diasSemana[d.getDay()]) dias.push(new Date(d))
    }
    return dias
  }

  async function handleAplicarPadrao() {
    if (!profissionalId) return
    const [hI, mI] = padraoInicio.split(':').map(Number)
    const [hF, mF] = padraoFim.split(':').map(Number)
    if (hF * 60 + mF <= hI * 60 + mI) {
      toast.error('O horário de fim precisa ser depois do início.')
      return
    }
    const dias = diasNoPeriodo()
    if (dias.length === 0) {
      toast.error('Selecione ao menos um dia da semana e um período válido.')
      return
    }
    if (dias.length > 120) {
      toast.error('Período muito longo — reduza o intervalo (máx. ~4 meses).')
      return
    }
    setApplying('aplicar')
    let criados = 0
    for (const dia of dias) {
      const inicio = new Date(dia)
      inicio.setHours(hI, mI, 0, 0)
      const fim = new Date(dia)
      fim.setHours(hF, mF, 0, 0)
      const key = toDateKey(dia)
      const jaExiste = blocos.some(
        (b) => toDateKey(new Date(b.inicio)) === key && toTimeInputValue(b.inicio) === padraoInicio && toTimeInputValue(b.fim) === padraoFim
      )
      if (jaExiste) continue
      try {
        const res = await fetch('/api/agenda/disponibilidades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profissionalId, inicio: inicio.toISOString(), fim: fim.toISOString(), repetirSemanas: 0 }),
        })
        if (res.ok) criados++
      } catch {
        // segue tentando os outros dias do período
      }
    }
    setApplying(null)
    toast.success(criados > 0 ? `${criados} dia(s) programado(s).` : 'Nenhum dia novo — os horários já estavam cadastrados.')
    carregar()
  }

  async function handleRemoverPadrao() {
    const dias = diasNoPeriodo()
    if (dias.length === 0) {
      toast.error('Selecione ao menos um dia da semana e um período válido.')
      return
    }
    const keys = new Set(dias.map(toDateKey))
    const alvo = blocos.filter((b) => keys.has(toDateKey(new Date(b.inicio))))
    if (alvo.length === 0) {
      toast.error('Nenhum horário cadastrado nesse período.')
      return
    }
    if (!(await confirm(`Remover ${alvo.length} bloco(s) de disponibilidade nesse período?`))) return
    setApplying('remover')
    for (const b of alvo) {
      try {
        await fetch(`/api/agenda/disponibilidades/${b.id}`, { method: 'DELETE' })
      } catch {
        // segue tentando os outros
      }
    }
    setApplying(null)
    toast.success('Disponibilidade removida do período selecionado.')
    carregar()
  }

  async function handleAddAvulso(e: React.FormEvent) {
    e.preventDefault()
    if (!profissionalId || !selectedDate || !avulsoInicio || !avulsoFim) return
    const inicio = new Date(`${selectedDate}T${avulsoInicio}:00`)
    const fim = new Date(`${selectedDate}T${avulsoFim}:00`)
    if (fim <= inicio) {
      toast.error('O horário de fim precisa ser depois do início.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/agenda/disponibilidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profissionalId, inicio: inicio.toISOString(), fim: fim.toISOString(), repetirSemanas: 0 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar bloco')
      toast.success('Horário adicionado.')
      carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar bloco')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/agenda/disponibilidades/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao remover bloco')
      setBlocos((prev) => prev.filter((b) => b.id !== id))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover bloco')
    }
  }

  async function handleClearDay(dateKey: string) {
    const alvo = blocos.filter((b) => toDateKey(new Date(b.inicio)) === dateKey)
    if (alvo.length === 0) return
    const label = new Date(`${dateKey}T00:00:00`).toLocaleDateString('pt-BR')
    if (!(await confirm(`Marcar ${label} como indisponível? Isso remove ${alvo.length} horário(s) cadastrado(s) nesse dia.`))) return
    setSaving(true)
    try {
      for (const b of alvo) {
        await fetch(`/api/agenda/disponibilidades/${b.id}`, { method: 'DELETE' })
      }
      toast.success('Dia marcado como indisponível.')
      carregar()
    } finally {
      setSaving(false)
    }
  }

  function toggleDiaSelecionado(dateKey: string) {
    setDiasSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(dateKey)) next.delete(dateKey)
      else next.add(dateKey)
      return next
    })
  }

  function toggleTodosDoMes(diasDoMes: string[]) {
    const todosMarcados = diasDoMes.every((k) => diasSelecionados.has(k))
    setDiasSelecionados((prev) => {
      const next = new Set(prev)
      diasDoMes.forEach((k) => (todosMarcados ? next.delete(k) : next.add(k)))
      return next
    })
  }

  async function handleBulkMarcarIndisponivel() {
    const alvo = blocos.filter((b) => diasSelecionados.has(toDateKey(new Date(b.inicio))))
    if (alvo.length === 0) return
    if (!(await confirm(`Marcar ${diasSelecionados.size} dia(s) selecionado(s) como indisponível? Isso remove ${alvo.length} horário(s) cadastrado(s).`))) return
    setSaving(true)
    try {
      for (const b of alvo) {
        await fetch(`/api/agenda/disponibilidades/${b.id}`, { method: 'DELETE' })
      }
      toast.success('Dias marcados como indisponíveis.')
      setDiasSelecionados(new Set())
      carregar()
    } finally {
      setSaving(false)
    }
  }

  async function handleBulkEditarHorario() {
    const [hI, mI] = bulkHoraInicio.split(':').map(Number)
    const [hF, mF] = bulkHoraFim.split(':').map(Number)
    if (hF * 60 + mF <= hI * 60 + mI) {
      toast.error('O horário de fim precisa ser depois do início.')
      return
    }
    setSaving(true)
    let atualizados = 0
    let pulados = 0
    for (const diaKey of diasSelecionados) {
      const blocosDoDiaSel = blocos.filter((b) => toDateKey(new Date(b.inicio)) === diaKey)
      if (blocosDoDiaSel.length !== 1) {
        pulados++
        continue
      }
      const inicio = new Date(`${diaKey}T${bulkHoraInicio}:00`)
      const fim = new Date(`${diaKey}T${bulkHoraFim}:00`)
      try {
        const res = await fetch(`/api/agenda/disponibilidades/${blocosDoDiaSel[0].id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inicio: inicio.toISOString(), fim: fim.toISOString() }),
        })
        if (res.ok) atualizados++
      } catch {
        // segue tentando os outros
      }
    }
    setSaving(false)
    setBulkEditando(false)
    setDiasSelecionados(new Set())
    toast.success(`${atualizados} dia(s) atualizado(s).${pulados > 0 ? ` ${pulados} dia(s) com mais de um horário foram ignorados — edite-os individualmente.` : ''}`)
    carregar()
  }

  function startEdit(b: Disponibilidade) {
    setEditingId(b.id)
    setEditData(toDateInputValue(b.inicio))
    setEditHoraInicio(toTimeInputValue(b.inicio))
    setEditHoraFim(toTimeInputValue(b.fim))
  }

  async function handleSaveEdit(id: string) {
    if (!editData || !editHoraInicio || !editHoraFim) return
    const inicio = new Date(`${editData}T${editHoraInicio}:00`)
    const fim = new Date(`${editData}T${editHoraFim}:00`)
    if (fim <= inicio) {
      toast.error('O horário de fim precisa ser depois do início.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/agenda/disponibilidades/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inicio: inicio.toISOString(), fim: fim.toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar bloco')
      toast.success('Disponibilidade atualizada.')
      setEditingId(null)
      carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar bloco')
    } finally {
      setSaving(false)
    }
  }

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {}
    for (const b of blocos) m[toDateKey(new Date(b.inicio))] = 'available'
    return m
  }, [blocos])

  // Lista "Próximos dias" agrupada por mês — evita uma lista infinita quando
  // o profissional tem disponibilidade programada por vários meses seguidos.
  const blocosPorMes = useMemo(() => {
    const porMes = new Map<string, { label: string; dias: Map<string, Disponibilidade[]> }>()
    for (const b of blocos) {
      const d = new Date(b.inicio)
      const mesKey = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`
      const diaKey = toDateKey(d)
      if (!porMes.has(mesKey)) {
        porMes.set(mesKey, { label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }), dias: new Map() })
      }
      const grupo = porMes.get(mesKey)!
      if (!grupo.dias.has(diaKey)) grupo.dias.set(diaKey, [])
      grupo.dias.get(diaKey)!.push(b)
    }
    return [...porMes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, grupo]) => ({
        key,
        label: grupo.label,
        dias: [...grupo.dias.entries()].sort(([a], [b]) => a.localeCompare(b)),
      }))
  }, [blocos])

  const mesAtivo = blocosPorMes.find((m) => m.key === mesSelecionado) ?? null

  function fecharModalMes() {
    setMesSelecionado(null)
    setDiasSelecionados(new Set())
    setBulkEditando(false)
  }

  const diasSelecionadosCount = diasNoPeriodo().length
  const blocosDoDia = selectedDate ? blocos.filter((b) => toDateKey(new Date(b.inicio)) === selectedDate) : blocos

  if (profissionais.length === 0) {
    return <p className="text-sm text-ink-400 py-8 text-center">Cadastre um profissional primeiro, na aba Profissionais.</p>
  }

  return (
    <div className="space-y-3">
      {ConfirmDialogElement}
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Profissional</label>
        <select value={profissionalId} onChange={(e) => { setProfissionalId(e.target.value); setSelectedDate(null); setMesSelecionado(null); setDiasSelecionados(new Set()) }} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm">
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        <div className="space-y-2">
          <AgendaCalendar
            dataTour="agenda-calendar"
            marks={marks}
            selected={selectedDate}
            onSelect={(key) => setSelectedDate((prev) => (prev === key ? null : key))}
            legend={{ available: 'Dia com horário disponível' }}
          />
          <p className="text-[11px] text-ink-400 px-1">Dias sem marcação verde estão indisponíveis.</p>
        </div>

        <div className="space-y-4 min-w-0">
          {/* Programar vários dias de uma vez */}
          <div className="bg-white p-4 rounded-xl border border-ink-200 space-y-3">
            <div>
              <p className="text-sm font-semibold text-ink-900">Programar vários dias de uma vez</p>
              <p className="text-xs text-ink-500">Escolha os dias da semana, o período e o horário — sem precisar cadastrar dia por dia.</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDiaSemana(i)}
                    className={`w-8 h-8 rounded-full text-xs font-semibold transition-colors ${
                      diasSemana[i] ? 'bg-brand-600 text-white' : 'bg-ink-100 text-ink-500 hover:bg-ink-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5 ml-1 text-[11px]">
                <button type="button" onClick={() => setDiasSemana([false, true, true, true, true, true, false])} className="font-medium text-brand-700 hover:underline">Dias úteis</button>
                <span className="text-ink-300">·</span>
                <button type="button" onClick={() => setDiasSemana([true, true, true, true, true, true, true])} className="font-medium text-brand-700 hover:underline">Todos</button>
                <span className="text-ink-300">·</span>
                <button type="button" onClick={() => setDiasSemana([false, false, false, false, false, false, false])} className="font-medium text-brand-700 hover:underline">Nenhum</button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">De</label>
                <input type="date" value={rangeDe} onChange={(e) => setRangeDe(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Até</label>
                <input type="date" value={rangeAte} onChange={(e) => setRangeAte(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Início</label>
                <input type="time" value={padraoInicio} onChange={(e) => setPadraoInicio(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-600 mb-1">Fim</label>
                <input type="time" value={padraoFim} onChange={(e) => setPadraoFim(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <p className="text-xs text-ink-500">
                {diasSelecionadosCount > 0 ? `${diasSelecionadosCount} dia(s) correspondem a esse período.` : 'Nenhum dia corresponde ainda — ajuste os dias da semana ou o período.'}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={handleRemoverPadrao} disabled={applying !== null} className="px-3 py-1.5 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50">
                  {applying === 'remover' ? 'Removendo...' : 'Marcar como indisponível'}
                </button>
                <button type="button" onClick={handleAplicarPadrao} disabled={applying !== null} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {applying === 'aplicar' ? 'Aplicando...' : 'Aplicar horário'}
                </button>
              </div>
            </div>
          </div>

          {selectedDate ? (
            /* Dia selecionado no calendário — edição fina de um dia específico */
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <p className="text-sm font-semibold text-ink-900 capitalize">
                  {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                </p>
                <div className="flex items-center gap-3">
                  {blocosDoDia.length > 0 && (
                    <button onClick={() => handleClearDay(selectedDate)} className="text-xs font-medium text-red-600 hover:underline">Marcar dia como indisponível</button>
                  )}
                  <button onClick={() => setSelectedDate(null)} className="text-xs font-medium text-brand-700 hover:underline">Ver próximos dias</button>
                </div>
              </div>

              <form onSubmit={handleAddAvulso} className="flex flex-wrap items-end gap-2 bg-white p-3 rounded-xl border border-ink-200">
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Início</label>
                  <input type="time" value={avulsoInicio} onChange={(e) => setAvulsoInicio(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-600 mb-1">Fim</label>
                  <input type="time" value={avulsoFim} onChange={(e) => setAvulsoFim(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                </div>
                <button type="submit" disabled={saving} className="px-3 py-1.5 bg-brand-50 text-brand-700 text-sm rounded-lg hover:bg-brand-100 disabled:opacity-50 flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" /> {saving ? 'Salvando...' : 'Adicionar horário nesse dia'}
                </button>
              </form>

              <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
                {loading && Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)}
                {!loading && blocosDoDia.length === 0 && (
                  <p className="p-6 text-center text-sm text-ink-400">Nenhum horário cadastrado nesse dia.</p>
                )}
                {!loading && blocosDoDia.map((b) => (
                  <div key={b.id} className="px-4 py-3">
                    {editingId === b.id ? (
                      <div className="flex flex-wrap items-end gap-2">
                        <div>
                          <label className="block text-xs font-medium text-ink-600 mb-1">Data</label>
                          <input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-600 mb-1">Início</label>
                          <input type="time" value={editHoraInicio} onChange={(e) => setEditHoraInicio(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-600 mb-1">Fim</label>
                          <input type="time" value={editHoraFim} onChange={(e) => setEditHoraFim(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                        </div>
                        <button onClick={() => handleSaveEdit(b.id)} disabled={saving} className="p-1.5 text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Salvar">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditingId(null)} className="p-1.5 text-ink-400 hover:bg-ink-50 rounded-lg transition-colors" title="Cancelar">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-ink-700">{formatDateTime(b.inicio)} — {formatDateTime(b.fim)}</p>
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(b)} className="p-1.5 text-ink-400 hover:text-brand-600 transition-colors" title="Editar">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDelete(b.id)} className="p-1.5 text-ink-400 hover:text-red-600 transition-colors" title="Remover">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Nenhum dia selecionado — navegação por mês, pra não virar uma lista infinita quando há vários meses programados */
            <div className="space-y-2">
              <p className="text-sm font-semibold text-ink-900">Próximos dias</p>

              {loading && (
                <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
                  {Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)}
                </div>
              )}

              {!loading && blocosPorMes.length === 0 && (
                <div className="bg-white rounded-xl border border-ink-200 p-6 text-center text-sm text-ink-400">
                  Nenhum bloco de disponibilidade cadastrado ainda. Use o painel acima pra programar os dias.
                </div>
              )}

              {!loading && blocosPorMes.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {blocosPorMes.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMesSelecionado(m.key)}
                      className="bg-white border border-ink-200 rounded-xl p-3 text-left hover:border-brand-300 hover:bg-brand-50/40 transition-colors"
                    >
                      <p className="text-sm font-semibold text-ink-900 capitalize">{m.label}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{m.dias.length} dia(s) disponíveis</p>
                    </button>
                  ))}
                </div>
              )}

              <Modal open={!!mesAtivo} onClose={fecharModalMes} title={mesAtivo?.label} widthClass="max-w-xl">
                {mesAtivo && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2 bg-ink-50 p-2.5 rounded-xl border border-ink-200">
                      <label className="flex items-center gap-2 text-xs text-ink-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mesAtivo.dias.length > 0 && mesAtivo.dias.every(([k]) => diasSelecionados.has(k))}
                          onChange={() => toggleTodosDoMes(mesAtivo.dias.map(([k]) => k))}
                          className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                        />
                        Selecionar todos os dias desse mês
                      </label>
                      {diasSelecionados.size > 0 && (
                        <div className="flex items-center flex-wrap gap-2">
                          <span className="text-xs text-ink-500">{diasSelecionados.size} selecionado(s)</span>
                          <button type="button" onClick={() => setBulkEditando((v) => !v)} className="px-2.5 py-1 text-xs font-medium text-brand-700 bg-brand-50 rounded-lg hover:bg-brand-100">
                            Mudar horário
                          </button>
                          <button type="button" onClick={handleBulkMarcarIndisponivel} disabled={saving} className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50">
                            Marcar indisponível
                          </button>
                        </div>
                      )}
                    </div>

                    {bulkEditando && diasSelecionados.size > 0 && (
                      <div className="flex flex-wrap items-end gap-2 bg-ink-50 p-3 rounded-xl border border-ink-200">
                        <div>
                          <label className="block text-xs font-medium text-ink-600 mb-1">Novo início</label>
                          <input type="time" value={bulkHoraInicio} onChange={(e) => setBulkHoraInicio(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-ink-600 mb-1">Novo fim</label>
                          <input type="time" value={bulkHoraFim} onChange={(e) => setBulkHoraFim(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
                        </div>
                        <button type="button" onClick={handleBulkEditarHorario} disabled={saving} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
                          Aplicar aos selecionados
                        </button>
                        <p className="text-[11px] text-ink-400 basis-full">Dias com mais de um horário cadastrado no mesmo dia são ignorados aqui — edite-os individualmente clicando no dia.</p>
                      </div>
                    )}

                    <div className="border border-ink-200 rounded-xl divide-y divide-ink-100">
                      {mesAtivo.dias.map(([diaKey, blocosDoDiaGrupo]) => (
                        <div key={diaKey} className="px-4 py-3 flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2.5 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              checked={diasSelecionados.has(diaKey)}
                              onChange={() => toggleDiaSelecionado(diaKey)}
                              className="w-4 h-4 shrink-0 rounded border-gray-300 text-brand-600 focus:ring-brand-400"
                            />
                            <button
                              type="button"
                              onClick={() => { setSelectedDate(diaKey); fecharModalMes() }}
                              className="text-sm text-ink-700 hover:text-brand-700 hover:underline capitalize truncate"
                            >
                              {new Date(`${diaKey}T00:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                            </button>
                          </label>
                          <div className="flex items-center gap-2 shrink-0">
                            <p className="text-sm text-ink-500">
                              {blocosDoDiaGrupo.map((b, i) => (
                                <span key={b.id}>{i > 0 && ', '}{toTimeInputValue(b.inicio)}–{toTimeInputValue(b.fim)}</span>
                              ))}
                            </p>
                            <button onClick={() => handleClearDay(diaKey)} className="p-1.5 text-ink-400 hover:text-red-600 transition-colors" title="Marcar dia como indisponível">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Agendamentos ───────────────────────────────────────────────────────── */

function AgendamentosTab({ profissionais, servicos }: { profissionais: Profissional[]; servicos: Servico[] }) {
  const [profissionalId, setProfissionalId] = useState('')
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const { confirm, ConfirmDialogElement } = useConfirmDialog()

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const qs = profissionalId ? `?profissionalId=${profissionalId}` : ''
      const res = await fetchJson<{ agendamentos: Agendamento[] }>(`/api/agenda/agendamentos${qs}`)
      setAgendamentos(res.agendamentos)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar agendamentos')
    } finally {
      setLoading(false)
    }
  }, [profissionalId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    carregar()
  }, [carregar])

  async function handleCancelar(id: string) {
    if (!(await confirm('Cancelar este agendamento? Isso também remove o evento do Google Calendar.'))) return
    try {
      const res = await fetch(`/api/agenda/agendamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelado' }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao cancelar')
      toast.success('Agendamento cancelado.')
      carregar()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao cancelar agendamento')
    }
  }

  const statusStyle: Record<Agendamento['status'], string> = {
    confirmado: 'bg-brand-50 text-brand-700',
    cancelado: 'bg-red-50 text-red-700',
    concluido: 'bg-ink-100 text-ink-600',
  }

  const marks = useMemo(() => {
    const m: Record<string, DayMark> = {}
    for (const a of agendamentos) {
      if (a.status !== 'cancelado') m[toDateKey(new Date(a.inicio))] = 'booked'
    }
    return m
  }, [agendamentos])

  const agendamentosDoDia = selectedDate
    ? agendamentos.filter((a) => toDateKey(new Date(a.inicio)) === selectedDate)
    : agendamentos

  return (
    <div className="space-y-3">
      {ConfirmDialogElement}
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Profissional</label>
          <select value={profissionalId} onChange={(e) => setProfissionalId(e.target.value)} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm">
            <option value="">Todos</option>
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          Novo agendamento
        </button>
      </div>

      {showForm && (
        <NovoAgendamentoForm
          profissionais={profissionais}
          servicos={servicos}
          onCreated={() => {
            setShowForm(false)
            carregar()
          }}
        />
      )}

      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        <AgendaCalendar
          marks={marks}
          selected={selectedDate}
          onSelect={(key) => setSelectedDate((prev) => (prev === key ? null : key))}
          legend={{ booked: 'Dia com agendamento' }}
        />

        <div className="space-y-3 min-w-0">
          {selectedDate && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-500">Mostrando agendamentos de {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR')}</p>
              <button onClick={() => setSelectedDate(null)} className="text-xs font-medium text-brand-700 hover:underline">Ver todos os dias</button>
            </div>
          )}

      <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
        {loading && Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)}
        {!loading && agendamentosDoDia.length === 0 && <p className="p-6 text-center text-sm text-ink-400">Nenhum agendamento {selectedDate ? 'nesse dia' : 'encontrado'}.</p>}
        {!loading && agendamentosDoDia.map((a) => {
          const profissional = profissionais.find((p) => p.id === a.profissionalId)
          const servico = servicos.find((s) => s.id === a.servicoId)
          return (
            <div key={a.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 break-words">{a.clienteNome} <span className="font-normal text-ink-400">· {a.clienteTelefone}</span></p>
                <p className="text-xs text-ink-500 break-words">
                  {servico?.nome ?? 'Serviço removido'} com {profissional?.nome ?? 'profissional removido'} · {formatDateTime(a.inicio)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs px-2 py-1 rounded-full ${statusStyle[a.status]}`}>{a.status}</span>
                {a.status === 'confirmado' && (
                  <button onClick={() => handleCancelar(a.id)} className="text-xs text-red-600 hover:underline">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
        </div>
      </div>
    </div>
  )
}

type Horario = { inicio: string; fim: string }

function NovoAgendamentoForm({
  profissionais,
  servicos,
  onCreated,
}: {
  profissionais: Profissional[]
  servicos: Servico[]
  onCreated: () => void
}) {
  const [profissionalId, setProfissionalId] = useState(profissionais[0]?.id ?? '')
  const [servicoId, setServicoId] = useState('')
  const [data, setData] = useState('')
  const [horarios, setHorarios] = useState<Horario[]>([])
  const [buscando, setBuscando] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [slotSelecionado, setSlotSelecionado] = useState<Horario | null>(null)
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)

  const servicosDoProfissional = servicos.filter(
    (s) => s.ativo && (!s.profissionalIds?.length || s.profissionalIds.includes(profissionalId))
  )

  async function handleBuscarHorarios(e: React.FormEvent) {
    e.preventDefault()
    if (!profissionalId || !servicoId || !data) return
    setBuscando(true)
    setBuscou(false)
    setSlotSelecionado(null)
    try {
      const de = startOfDayISO(data)
      const ate = endOfDayISO(data)
      const res = await fetchJson<{ horarios: Horario[] }>(
        `/api/agenda/horarios-livres?profissionalId=${profissionalId}&servicoId=${servicoId}&de=${de}&ate=${ate}`
      )
      setHorarios(res.horarios)
      setBuscou(true)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao buscar horários livres')
    } finally {
      setBuscando(false)
    }
  }

  async function handleConfirmar(e: React.FormEvent) {
    e.preventDefault()
    if (!slotSelecionado || !clienteNome.trim() || !clienteTelefone.trim()) return
    setSalvando(true)
    try {
      const res = await fetch('/api/agenda/agendamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profissionalId,
          servicoId,
          clienteNome: clienteNome.trim(),
          clienteTelefone: clienteTelefone.trim(),
          inicio: slotSelecionado.inicio,
          origem: 'manual',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar agendamento')
      toast.success('Agendamento criado.')
      onCreated()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao criar agendamento')
    } finally {
      setSalvando(false)
    }
  }

  if (profissionais.length === 0) {
    return <p className="text-sm text-ink-400 py-4 text-center bg-white rounded-xl border border-ink-200">Cadastre um profissional primeiro, na aba Profissionais.</p>
  }
  if (servicos.length === 0) {
    return <p className="text-sm text-ink-400 py-4 text-center bg-white rounded-xl border border-ink-200">Cadastre um serviço primeiro, na aba Serviços.</p>
  }

  return (
    <div className="bg-white p-3 rounded-xl border border-ink-200 space-y-3">
      <form onSubmit={handleBuscarHorarios} className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Profissional</label>
          <select
            value={profissionalId}
            onChange={(e) => {
              setProfissionalId(e.target.value)
              setServicoId('')
              setBuscou(false)
              setSlotSelecionado(null)
            }}
            className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
          >
            {profissionais.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Serviço</label>
          <select
            value={servicoId}
            onChange={(e) => { setServicoId(e.target.value); setBuscou(false); setSlotSelecionado(null) }}
            required
            className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
          >
            <option value="">Selecione</option>
            {servicosDoProfissional.map((s) => (
              <option key={s.id} value={s.id}>{s.nome} ({s.duracaoMinutos} min)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => { setData(e.target.value); setBuscou(false); setSlotSelecionado(null) }}
            required
            className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
          />
        </div>
        <button type="submit" disabled={buscando || !servicoId || !data} className="px-3 py-1.5 bg-ink-800 text-white text-sm rounded-lg hover:bg-ink-900 disabled:opacity-50">
          {buscando ? 'Buscando...' : 'Buscar horários'}
        </button>
      </form>

      {buscou && (
        <div>
          <label className="block text-xs font-medium text-ink-600 mb-1">Horários livres</label>
          {horarios.length === 0 ? (
            <p className="text-xs text-ink-400">Nenhum horário livre nesse dia.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h.inicio}
                  type="button"
                  onClick={() => setSlotSelecionado(h)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                    slotSelecionado?.inicio === h.inicio
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-ink-200 text-ink-700 hover:border-brand-400'
                  }`}
                >
                  {toTimeInputValue(h.inicio)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {slotSelecionado && (
        <form onSubmit={handleConfirmar} className="flex flex-wrap items-end gap-2 pt-2 border-t border-ink-100">
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">Nome do cliente</label>
            <input value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-ink-600 mb-1">WhatsApp do cliente</label>
            <input
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
              placeholder="Ex: 5511999990000"
              required
              className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm"
            />
          </div>
          <button type="submit" disabled={salvando} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
            {salvando ? 'Confirmando...' : `Confirmar ${toTimeInputValue(slotSelecionado.inicio)}`}
          </button>
        </form>
      )}
    </div>
  )
}
