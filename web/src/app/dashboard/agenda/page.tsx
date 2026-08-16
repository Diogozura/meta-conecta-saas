'use client'

import { useEffect, useState, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  Loader2,
  Plus,
  Trash2,
  Link2,
  CheckCircle2,
  X,
  Pencil,
  Check,
  AlertCircle,
  Users,
  Scissors,
  Clock,
  CalendarCheck,
  ChevronDown,
} from 'lucide-react'

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
  { key: 'profissionais', label: 'Equipe' },
  { key: 'servicos', label: 'Serviços' },
  { key: 'disponibilidade', label: 'Horários' },
  { key: 'agendamentos', label: 'Agendamentos' },
]

/** Duas primeiras iniciais de um nome, pra usar no avatar circular das listas. */
function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/)
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : nome.slice(0, 2)
  return letras.toUpperCase()
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Telinha modal reutilizável pros formulários de criação (Equipe, Serviços, Horários, Agendamento). */
function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

/** Dropdown customizado — mesma altura/estilo dos inputs de texto, sem o destaque azul padrão do <select> nativo do navegador. */
function Select({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 transition-colors"
      >
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>{selected?.label ?? placeholder ?? 'Selecione'}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {/* Input escondido só pra validação HTML nativa (required) funcionar dentro de formulários. */}
      {required && <input tabIndex={-1} value={value} required onChange={() => {}} className="sr-only" />}
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  o.value === value ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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
  const data = await res.json()
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Erro ao carregar dados')
  return data
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
  const [sessionExpired, setSessionExpired] = useState(false)
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
      setSessionExpired(false)
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setSessionExpired(true)
      } else {
        toast.error(error instanceof Error ? error.message : 'Erro ao carregar agenda')
      }
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

  const counts: Partial<Record<TabKey, number>> = {
    profissionais: profissionais.length,
    servicos: servicos.length,
  }

  return (
    <div className="space-y-4">
      {sessionExpired && (
        <div className="flex items-start gap-2.5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-red-900">Sua sessão expirou</p>
            <p className="text-xs text-red-700 mt-0.5">Entre novamente para carregar e salvar os dados desta página.</p>
            <a href="/login" className="inline-block mt-1.5 text-xs font-semibold text-red-700 hover:underline">
              Entrar
            </a>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-10 bg-gray-50 pt-0 pb-1 -mt-1">
        <div className="grid grid-cols-4 gap-0.5 p-1 bg-gray-100 rounded-xl">
          {tabs.map((tab) => {
            const count = counts[tab.key]
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center justify-center gap-1.5 min-h-8 px-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeTab === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span className={`text-[11px] font-bold tabular-nums ${activeTab === tab.key ? 'text-green-600' : 'text-gray-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : (
        <>
          {activeTab === 'profissionais' && (
            <ProfissionaisTab profissionais={profissionais} onChanged={carregarBase} />
          )}
          {activeTab === 'servicos' && (
            <ServicosTab servicos={servicos} profissionais={profissionais} onChanged={carregarBase} />
          )}
          {activeTab === 'disponibilidade' && (
            <DisponibilidadeTab profissionais={profissionais} onGoToEquipe={() => setActiveTab('profissionais')} />
          )}
          {activeTab === 'agendamentos' && <AgendamentosTab profissionais={profissionais} servicos={servicos} />}
        </>
      )}
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Equipe</h2>
          <p className="text-sm text-gray-500 mt-0.5">Quem atende no seu negócio</p>
        </div>
        {profissionais.length > 0 && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            Novo
          </button>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo profissional" subtitle="Quem vai atender no seu negócio">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Telefone (opcional)</label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+5511999999999"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {profissionais.length === 0 && !showForm ? (
        <div className="flex flex-col items-center text-center py-8 px-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-11 h-11 grid place-items-center rounded-xl bg-green-50 text-green-700 mb-3.5">
            <Users className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Nenhum profissional cadastrado</p>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-[30ch]">
            Cadastre quem atende para abrir horários e receber agendamentos.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Cadastrar profissional
          </button>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {profissionais.map((p) => (
          <div key={p.id} className="px-4 py-3">
            {editingId === p.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                  <input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Telefone</label>
                  <input value={editTelefone} onChange={(e) => setEditTelefone(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 pb-2">
                  <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} /> Ativo
                </label>
                <button onClick={() => handleSaveEdit(p.id)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Salvar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" title="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-green-50 text-green-700 text-xs font-bold">
                    {iniciais(p.nome)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.nome}{!p.ativo && <span className="ml-2 text-[10px] text-gray-400 font-normal">inativo</span>}</p>
                    <p className="text-xs text-gray-500">{p.telefone || 'sem telefone'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.google?.conectado ? (
                    <span className="flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Google conectado{p.google.email ? ` (${p.google.email})` : ''}
                    </span>
                  ) : (
                    <a
                      href={`/api/agenda/profissionais/${p.id}/google/connect`}
                      className="flex items-center gap-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded-full hover:bg-blue-100 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" /> Conectar Google Calendar
                    </a>
                  )}
                  <button onClick={() => startEdit(p)} className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(p.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Serviços</h2>
          <p className="text-sm text-gray-500 mt-0.5">{servicos.length} {servicos.length === 1 ? 'ativo' : 'ativos'}</p>
        </div>
        {servicos.length > 0 && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
          >
            {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            Novo
          </button>
        )}
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo serviço" subtitle="O que você oferece pros seus clientes">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Duração (minutos)</label>
            <input
              type="number"
              min={5}
              step={5}
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          {profissionais.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quem atende esse serviço</label>
              <p className="text-xs text-gray-400 mb-2">Deixe vazio pra qualquer profissional atender</p>
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-44 overflow-y-auto">
                {profissionais.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selecionados.includes(p.id)}
                      onChange={() => toggleProfissional(p.id)}
                      className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
                    />
                    {p.nome}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {servicos.length === 0 && !showForm ? (
        <div className="flex flex-col items-center text-center py-8 px-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-11 h-11 grid place-items-center rounded-xl bg-green-50 text-green-700 mb-3.5">
            <Scissors className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Nenhum serviço cadastrado</p>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-[30ch]">
            Cadastre o que você oferece pra liberar agendamento pelos clientes.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Cadastrar serviço
          </button>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {servicos.map((s) => (
          <div key={s.id} className="px-4 py-3">
            {editingId === s.id ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nome</label>
                    <input value={editNome} onChange={(e) => setEditNome(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duração (minutos)</label>
                    <input type="number" min={5} step={5} value={editDuracao} onChange={(e) => setEditDuracao(e.target.value)} className="w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 pb-2">
                    <input type="checkbox" checked={editAtivo} onChange={(e) => setEditAtivo(e.target.checked)} /> Ativo
                  </label>
                  <button onClick={() => handleSaveEdit(s.id)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Salvar">
                    <Check className="w-4 h-4" />
                  </button>
                  <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" title="Cancelar">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                {profissionais.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Quem atende esse serviço</label>
                    <p className="text-[11px] text-gray-400 mb-1.5">Deixe vazio pra qualquer profissional atender</p>
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto bg-white">
                      {profissionais.map((p) => (
                        <label key={p.id} className="flex items-center gap-2.5 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editSelecionados.includes(p.id)}
                            onChange={() => toggleEditProfissional(p.id)}
                            className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-400"
                          />
                          {p.nome}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-green-50 text-green-700 text-xs font-bold">
                    {iniciais(s.nome)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{s.nome}{!s.ativo && <span className="ml-2 text-[10px] text-gray-400 font-normal">inativo</span>}</p>
                    <p className="text-xs text-gray-500">
                      {s.duracaoMinutos} min
                      {s.profissionalIds?.length ? ` · ${s.profissionalIds.map((id) => profissionais.find((p) => p.id === id)?.nome ?? id).join(', ')}` : ' · qualquer profissional'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(s)} className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Remover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  )
}

/* ─── Disponibilidade ────────────────────────────────────────────────────── */

function DisponibilidadeTab({ profissionais, onGoToEquipe }: { profissionais: Profissional[]; onGoToEquipe: () => void }) {
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
  const [showForm, setShowForm] = useState(false)

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
      setShowForm(false)
      setData('')
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

  if (profissionais.length === 0) {
    return (
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Horários</h2>
          <p className="text-sm text-gray-500 mt-0.5">Quando você aceita agendamentos</p>
        </div>
        <div className="flex flex-col items-center text-center py-8 px-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-11 h-11 grid place-items-center rounded-xl bg-green-50 text-green-700 mb-3.5">
            <Clock className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Defina os horários primeiro</p>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-[30ch]">Cadastre a equipe para liberar a grade de horários.</p>
          <button
            onClick={onGoToEquipe}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Cadastrar profissional
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Horários</h2>
          <p className="text-sm text-gray-500 mt-0.5">Quando você aceita agendamentos</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Novo
        </button>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Profissional</label>
        <Select
          value={profissionalId}
          onChange={setProfissionalId}
          options={profissionais.map((p) => ({ value: p.id, label: p.nome }))}
        />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo bloco de horário" subtitle="Quando esse profissional está disponível">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Data</label>
            <input
              type="date"
              value={data}
              onChange={(e) => setData(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Início</label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Fim</label>
              <input
                type="time"
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Repetir por (semanas)</label>
            <input
              type="number"
              min={0}
              max={52}
              value={repetirSemanas}
              onChange={(e) => setRepetirSemanas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Adicionar bloco'}
            </button>
          </div>
        </form>
      </Modal>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {loading && <p className="p-6 text-center text-sm text-gray-400">Carregando...</p>}
        {!loading && blocos.length === 0 && <p className="p-6 text-center text-sm text-gray-400">Nenhum bloco de disponibilidade nos próximos 90 dias.</p>}
        {blocos.map((b) => (
          <div key={b.id} className="px-4 py-3">
            {editingId === b.id ? (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                  <input type="date" value={editData} onChange={(e) => setEditData(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Início</label>
                  <input type="time" value={editHoraInicio} onChange={(e) => setEditHoraInicio(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fim</label>
                  <input type="time" value={editHoraFim} onChange={(e) => setEditHoraFim(e.target.value)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
                </div>
                <button onClick={() => handleSaveEdit(b.id)} disabled={saving} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Salvar">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:bg-gray-50 rounded-lg transition-colors" title="Cancelar">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-green-50 text-green-700">
                    <Clock className="w-4 h-4" />
                  </span>
                  <p className="text-sm text-gray-700 truncate">{formatDateTime(b.inicio)} — {formatDateTime(b.fim)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(b)} className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Remover">
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

/* ─── Agendamentos ───────────────────────────────────────────────────────── */

function AgendamentosTab({ profissionais, servicos }: { profissionais: Profissional[]; servicos: Servico[] }) {
  const [profissionalId, setProfissionalId] = useState('')
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

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
    confirmado: 'bg-green-50 text-green-700',
    cancelado: 'bg-red-50 text-red-700',
    concluido: 'bg-gray-100 text-gray-600',
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Agendamentos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{agendamentos.length} {agendamentos.length === 1 ? 'encontrado' : 'encontrados'}</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="shrink-0 flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-green-700 text-xs font-semibold rounded-lg hover:bg-green-50 transition-colors"
        >
          {showForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
          Novo
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Profissional</label>
        <Select
          value={profissionalId}
          onChange={setProfissionalId}
          placeholder="Todos"
          options={[{ value: '', label: 'Todos' }, ...profissionais.map((p) => ({ value: p.id, label: p.nome }))]}
        />
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Novo agendamento" subtitle="Busque um horário livre e confirme com o cliente">
        <NovoAgendamentoForm
          profissionais={profissionais}
          servicos={servicos}
          onCreated={() => {
            setShowForm(false)
            carregar()
          }}
        />
      </Modal>

      {loading ? (
        <p className="p-6 text-center text-sm text-gray-400">Carregando...</p>
      ) : agendamentos.length === 0 && !showForm ? (
        <div className="flex flex-col items-center text-center py-8 px-6 bg-white border border-gray-200 rounded-2xl shadow-sm">
          <div className="w-11 h-11 grid place-items-center rounded-xl bg-green-50 text-green-700 mb-3.5">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">Nenhum agendamento encontrado</p>
          <p className="text-xs text-gray-500 mt-1 mb-4 max-w-[30ch]">
            Agendamentos feitos pelo cliente no WhatsApp ou por você aparecem aqui.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            Novo agendamento
          </button>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {agendamentos.map((a) => {
          const profissional = profissionais.find((p) => p.id === a.profissionalId)
          const servico = servicos.find((s) => s.id === a.servicoId)
          return (
            <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 w-9 h-9 grid place-items-center rounded-full bg-green-50 text-green-700 text-[11px] font-bold">
                  {toTimeInputValue(a.inicio)}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{a.clienteNome} <span className="font-normal text-gray-400">· {a.clienteTelefone}</span></p>
                  <p className="text-xs text-gray-500 truncate">
                    {servico?.nome ?? 'Serviço removido'} com {profissional?.nome ?? 'profissional removido'} · {formatDateTime(a.inicio)}
                  </p>
                </div>
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
      )}
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
    return <p className="text-sm text-gray-500 py-4 text-center">Cadastre um profissional primeiro, na aba Equipe.</p>
  }
  if (servicos.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">Cadastre um serviço primeiro, na aba Serviços.</p>
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleBuscarHorarios} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Profissional</label>
          <Select
            value={profissionalId}
            onChange={(v) => {
              setProfissionalId(v)
              setServicoId('')
              setBuscou(false)
              setSlotSelecionado(null)
            }}
            options={profissionais.map((p) => ({ value: p.id, label: p.nome }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Serviço</label>
          <Select
            value={servicoId}
            onChange={(v) => { setServicoId(v); setBuscou(false); setSlotSelecionado(null) }}
            required
            placeholder="Selecione"
            options={servicosDoProfissional.map((s) => ({ value: s.id, label: `${s.nome} (${s.duracaoMinutos} min)` }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Data</label>
          <input
            type="date"
            value={data}
            onChange={(e) => { setData(e.target.value); setBuscou(false); setSlotSelecionado(null) }}
            required
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <button
          type="submit"
          disabled={buscando || !servicoId || !data}
          className="w-full px-4 py-2.5 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50"
        >
          {buscando ? 'Buscando...' : 'Buscar horários'}
        </button>
      </form>

      {buscou && (
        <div className="pt-3 border-t border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">Horários livres</label>
          {horarios.length === 0 ? (
            <p className="text-xs text-gray-400">Nenhum horário livre nesse dia.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {horarios.map((h) => (
                <button
                  key={h.inicio}
                  type="button"
                  onClick={() => setSlotSelecionado(h)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                    slotSelecionado?.inicio === h.inicio
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-green-400'
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
        <form onSubmit={handleConfirmar} className="space-y-4 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome do cliente</label>
            <input
              value={clienteNome}
              onChange={(e) => setClienteNome(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">WhatsApp do cliente</label>
            <input
              value={clienteTelefone}
              onChange={(e) => setClienteTelefone(e.target.value)}
              placeholder="Ex: 5511999990000"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full px-4 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {salvando ? 'Confirmando...' : `Confirmar ${toTimeInputValue(slotSelecionado.inicio)}`}
          </button>
        </form>
      )}
    </div>
  )
}
