'use client'

import { useEffect, useState, Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Calendar, Plus, Trash2, Link2, CheckCircle2, X, Pencil, Check } from 'lucide-react'
import { AgendaCalendar, toDateKey, type DayMark } from '@/components/agenda/AgendaCalendar'
import { Skeleton } from '@/components/Skeleton'

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
    if (!confirm('Remover este profissional? Isso não cancela agendamentos já criados.')) return
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{p.nome}{!p.ativo && <span className="ml-2 text-[10px] text-ink-400 font-normal">inativo</span>}</p>
                  <p className="text-xs text-ink-500">{p.telefone || 'sem telefone'}</p>
                </div>
                <div className="flex items-center gap-2">
                  {p.google?.conectado ? (
                    <>
                      <span className="flex items-center gap-1 text-xs text-brand-700 bg-brand-50 px-2 py-1 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Google conectado{p.google.email ? ` (${p.google.email})` : ''}
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
    if (!confirm('Remover este serviço?')) return
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">{s.nome}{!s.ativo && <span className="ml-2 text-[10px] text-ink-400 font-normal">inativo</span>}</p>
                  <p className="text-xs text-ink-500">
                    {s.duracaoMinutos} min
                    {s.profissionalIds?.length ? ` · ${s.profissionalIds.map((id) => profissionais.find((p) => p.id === id)?.nome ?? id).join(', ')}` : ' · qualquer profissional'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
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

function DisponibilidadeTab({ profissionais }: { profissionais: Profissional[] }) {
  const [profissionalId, setProfissionalId] = useState(profissionais[0]?.id ?? '')
  const [blocos, setBlocos] = useState<Disponibilidade[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState('')
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('18:00')
  const [repetirSemanas, setRepetirSemanas] = useState('0')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState('')
  const [editHoraInicio, setEditHoraInicio] = useState('')
  const [editHoraFim, setEditHoraFim] = useState('')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!profissionalId) {
      setBlocos([])
      return
    }
    setLoading(true)
    try {
      const de = new Date()
      const ate = new Date(de.getTime() + 90 * 24 * 60 * 60 * 1000)
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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!profissionalId || !data || !horaInicio || !horaFim) return
    const inicio = new Date(`${data}T${horaInicio}:00`)
    const fim = new Date(`${data}T${horaFim}:00`)
    if (fim <= inicio) {
      toast.error('O horário de fim precisa ser depois do início.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/agenda/disponibilidades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profissionalId,
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          repetirSemanas: parseInt(repetirSemanas, 10) || 0,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao criar bloco')
      toast.success('Disponibilidade criada.')
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

  const blocosDoDia = selectedDate ? blocos.filter((b) => toDateKey(new Date(b.inicio)) === selectedDate) : blocos

  if (profissionais.length === 0) {
    return <p className="text-sm text-ink-400 py-8 text-center">Cadastre um profissional primeiro, na aba Profissionais.</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-ink-600 mb-1">Profissional</label>
        <select value={profissionalId} onChange={(e) => { setProfissionalId(e.target.value); setSelectedDate(null) }} className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm">
          {profissionais.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 items-start">
        <AgendaCalendar
          dataTour="agenda-calendar"
          marks={marks}
          selected={selectedDate}
          onSelect={(key) => {
            setSelectedDate((prev) => (prev === key ? null : key))
            setData(key)
          }}
          legend={{ available: 'Dia com horário livre cadastrado' }}
        />

        <div className="space-y-3 min-w-0">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-2 bg-white p-3 rounded-xl border border-ink-200">
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Data</label>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Início</label>
              <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Fim</label>
              <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required className="px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-600 mb-1">Repetir por (semanas)</label>
              <input type="number" min={0} max={52} value={repetirSemanas} onChange={(e) => setRepetirSemanas(e.target.value)} className="w-20 px-3 py-1.5 border border-ink-200 rounded-lg text-sm" />
            </div>
            <button type="submit" disabled={saving} className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Salvando...' : 'Adicionar bloco'}
            </button>
          </form>

          {selectedDate && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-ink-500">Mostrando blocos de {new Date(`${selectedDate}T00:00:00`).toLocaleDateString('pt-BR')}</p>
              <button onClick={() => setSelectedDate(null)} className="text-xs font-medium text-brand-700 hover:underline">Ver todos os dias</button>
            </div>
          )}

      <div className="bg-white rounded-xl border border-ink-200 divide-y divide-ink-100">
        {loading && Array.from({ length: 3 }).map((_, i) => <ListRowSkeleton key={i} />)}
        {!loading && blocosDoDia.length === 0 && <p className="p-6 text-center text-sm text-ink-400">Nenhum bloco de disponibilidade {selectedDate ? 'nesse dia' : 'nos próximos 90 dias'}.</p>}
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
    if (!confirm('Cancelar este agendamento? Isso também remove o evento do Google Calendar.')) return
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
            <div key={a.id} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-ink-900">{a.clienteNome} <span className="font-normal text-ink-400">· {a.clienteTelefone}</span></p>
                <p className="text-xs text-ink-500">
                  {servico?.nome ?? 'Serviço removido'} com {profissional?.nome ?? 'profissional removido'} · {formatDateTime(a.inicio)}
                </p>
              </div>
              <div className="flex items-center gap-2">
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
