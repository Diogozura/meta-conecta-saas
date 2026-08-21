'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout, enableViewAsClient, disableViewAsClient } from '@/lib/auth'
import {
  Building2,
  LayoutDashboard,
  LogOut,
  ChevronRight,
  Menu,
  X,
  Settings,
  Calendar,
  HelpCircle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Eye,
  Loader2,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Toaster } from 'sonner'
import { RealtimeListeners } from '@/components/RealtimeListeners'
import { ConnectWabaPrompt } from '@/components/ConnectWabaPrompt'
import { Logo } from '@/components/Logo'
import { WhatsAppGlyph /*, InstagramGlyph, FacebookGlyph */ } from '@/components/BrandIcons'
import { TourProvider, useTour } from '@/lib/tour/TourContext'
import { getGlobalTourSteps, getPageTourSteps } from '@/lib/tour/steps'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  tour?: string
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Visão Geral', icon: LayoutDashboard, tour: 'nav-visao-geral' },
  { href: '/dashboard/agenda', label: 'Agenda', icon: Calendar, tour: 'nav-agenda' },
]

const manageNavItems: (NavItem & { platformAdminOnly: boolean })[] = [
  { href: '/dashboard/clientes', label: 'Clientes', icon: Building2, platformAdminOnly: true, tour: 'nav-clientes' },
  { href: '/dashboard/configuracoes', label: 'Configurações', icon: Settings, platformAdminOnly: false, tour: 'nav-configuracoes' },
]

const TOUR_SEEN_KEY = 'zybot_tour_seen_global'
const WABA_SKIP_PATH_PREFIXES = ['/dashboard/onboarding', '/dashboard/configuracoes']

export default function DashboardShell({
  isPlatformAdmin,
  isRealPlatformAdmin,
  viewingAsClient,
  children,
}: {
  isPlatformAdmin: boolean
  isRealPlatformAdmin: boolean
  viewingAsClient: boolean
  children: React.ReactNode
}) {
  return (
    <TourProvider>
      <DashboardShellInner isPlatformAdmin={isPlatformAdmin} isRealPlatformAdmin={isRealPlatformAdmin} viewingAsClient={viewingAsClient}>
        {children}
      </DashboardShellInner>
    </TourProvider>
  )
}

function DashboardShellInner({
  isPlatformAdmin,
  isRealPlatformAdmin,
  viewingAsClient,
  children,
}: {
  isPlatformAdmin: boolean
  isRealPlatformAdmin: boolean
  viewingAsClient: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const helpRef = useRef<HTMLDivElement>(null)
  const { active, steps, index, start } = useTour()

  // Gate que roda ANTES de liberar o dashboard (e antes do tour): checa se
  // essa conta já tem WhatsApp conectado. Roda de novo a cada login/recarga
  // da página (o estado é só do componente, não fica salvo) — "Agora não"
  // libera a tela dessa vez, mas o aviso volta no próximo acesso, até a
  // conta realmente conectar um número.
  const [wabaGate, setWabaGate] = useState<'checking' | 'blocked' | 'clear'>('checking')

  useEffect(() => {
    const enabled = !isPlatformAdmin || viewingAsClient
    const onSkipPath = WABA_SKIP_PATH_PREFIXES.some((p) => pathname.startsWith(p))

    if (!enabled || onSkipPath) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- decide síncrono se a checagem se aplica antes de disparar o fetch
      setWabaGate('clear')
      return
    }

    let cancelled = false
    fetch('/api/meta/credentials')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        const conectado = !!(data.credentials?.wabaId && data.credentials?.phoneNumberId)
        setWabaGate(conectado ? 'clear' : 'blocked')
      })
      .catch(() => {
        // Falha na checagem não pode travar o dashboard pra sempre.
        if (!cancelled) setWabaGate('clear')
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roda só uma vez por sessão, não a cada navegação interna
  }, [])

  function dismissWabaGate() {
    setWabaGate('clear')
  }

  // "Clientes" (Empresas) é uma tela de admin de plataforma — vê/gerencia
  // TODAS as empresas. Usuários comuns de uma empresa (mesmo Administrador
  // daquela empresa) nunca veem esse item no menu.
  const visibleManageItems = manageNavItems.filter((item) => !item.platformAdminOnly || isPlatformAdmin)
  const allLabeledItems: { href: string; label: string }[] = [
    ...mainNavItems,
    { href: '/dashboard/conversas', label: 'Conversas' },
    ...visibleManageItems,
  ]

  useEffect(() => {
    // Não inicia o tour enquanto a checagem de conexão ainda não terminou —
    // evita os dois popups disputando a tela ao mesmo tempo.
    if (wabaGate === 'checking') return
    const seen = window.localStorage.getItem(TOUR_SEEN_KEY)
    if (!seen) {
      const timer = setTimeout(() => {
        start(getGlobalTourSteps(isPlatformAdmin))
        window.localStorage.setItem(TOUR_SEEN_KEY, '1')
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isPlatformAdmin, start, wabaGate])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  // Em telas estreitas o menu lateral fica escondido (fora da tela) por
  // padrão — sem isso, os passos do tour que apontam pra itens do menu
  // (Visão Geral, Agenda, WhatsApp, Clientes, Configurações) ficavam
  // destacando algo invisível atrás do menu fechado. Abre o menu sozinho
  // durante esses passos e fecha de volta nos passos que não precisam dele.
  useEffect(() => {
    if (!active) return
    if (window.innerWidth >= 1024) return
    const isSidebarStep = steps[index]?.target.startsWith('[data-tour="nav-')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o menu lateral com o passo atual do tour, que só é conhecido depois do efeito medir a viewport
    setSidebarOpen(!!isSidebarStep)
  }, [active, steps, index])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fecha o menu que o tour abriu sozinho quando o tour termina
    if (!active) setSidebarOpen(false)
  }, [active])

  const pageTourSteps = getPageTourSteps(pathname)

  // Não libera nada da tela (nem o menu) até saber se precisa mostrar o
  // aviso de conexão — evita o flash do dashboard "vazio" e a disputa com
  // o tour guiado, que só começa depois que esse gate resolve.
  if (wabaGate === 'checking') {
    return (
      <div className="flex h-screen items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-4">
          <Logo markClassName="w-10 h-10 animate-pulse" textClassName="hidden" />
          <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-ink-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-ink-200 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-ink-100">
          <Logo markClassName="w-8 h-8" textClassName="text-lg font-bold text-ink-900" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto scrollbar-thin">
          <NavSection>
            {mainNavItems.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} onNavigate={() => setSidebarOpen(false)} />
            ))}
          </NavSection>

          <NavSection label="Canais de atendimento">
            <NavLink
              item={{ href: '/dashboard/conversas', label: 'WhatsApp', icon: WhatsAppGlyph, tour: 'nav-conversas' }}
              active={pathname.startsWith('/dashboard/conversas')}
              onNavigate={() => setSidebarOpen(false)}
            />
            {/* Instagram/Facebook pausados sem previsão — reativar quando entrarem em desenvolvimento de novo. */}
            {/* <ComingSoonRow icon={InstagramGlyph} label="Instagram" /> */}
            {/* <ComingSoonRow icon={FacebookGlyph} label="Facebook" /> */}
          </NavSection>

          <NavSection label="Administração">
            {visibleManageItems.map((item) => (
              <NavLink key={item.href} item={item} active={pathname === item.href} onNavigate={() => setSidebarOpen(false)} />
            ))}
          </NavSection>
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-ink-100">
          <form action={logout}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-ink-600 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="w-5 h-5 text-ink-400" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-ink-200 px-4 py-3 flex items-center gap-4 shrink-0">
          <button
            className="lg:hidden p-2 rounded-md text-ink-500 hover:bg-ink-100"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-ink-800">
              {allLabeledItems.find((n) => n.href === pathname)?.label ?? 'Dashboard'}
            </h1>
          </div>
          <div className="flex items-center gap-2 relative" ref={helpRef}>
            <button
              data-tour="topbar-help"
              onClick={() => setHelpOpen((v) => !v)}
              className="w-8 h-8 flex items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-brand-700 transition-colors"
              aria-label="Ajuda e tour guiado"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            {helpOpen && (
              <div className="absolute right-0 top-11 w-64 bg-white rounded-xl border border-ink-200 shadow-lg py-1.5 animate-fade-in z-40">
                <button
                  onClick={() => {
                    setHelpOpen(false)
                    if (pageTourSteps.length > 0) start(pageTourSteps)
                  }}
                  disabled={pageTourSteps.length === 0}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-ink-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-accent-600" />
                  Tour desta página
                </button>
                <button
                  onClick={() => {
                    setHelpOpen(false)
                    start(getGlobalTourSteps(isPlatformAdmin))
                  }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-ink-700 hover:bg-ink-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-brand-600" />
                  Tour completo do sistema
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 pl-2 border-l border-ink-100 ml-1">
              {isPlatformAdmin && (
                <span className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-full bg-accent-50 text-accent-700 text-[11px] font-semibold">
                  <ShieldCheck className="w-3 h-3" />
                  Admin master
                </span>
              )}
              {isRealPlatformAdmin && (
                <form action={viewingAsClient ? disableViewAsClient : enableViewAsClient}>
                  <button
                    type="submit"
                    title={viewingAsClient ? 'Voltar para a visão de admin master' : 'Pré-visualizar como um cliente vê o sistema'}
                    className={`hidden sm:flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold transition-colors ${
                      viewingAsClient
                        ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                        : 'border border-ink-200 text-ink-500 hover:bg-ink-50'
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    {viewingAsClient ? 'Voltar ao admin' : 'Ver como cliente'}
                  </button>
                </form>
              )}
              <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-brand-700">U</span>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* Alertas bonitinhos e Listeners de Webhooks em tempo real */}
      <Toaster richColors />
      <RealtimeListeners />
      <ConnectWabaPrompt open={wabaGate === 'blocked'} onDismiss={dismissWabaGate} />
    </div>
  )
}

function NavSection({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      {label && (
        <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
      )}
      {children}
    </div>
  )
}

function NavLink({ item, active, onNavigate }: { item: NavItem; active: boolean; onNavigate: () => void }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      data-tour={item.tour}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group ${
        active ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
      }`}
    >
      <Icon className={`w-5 h-5 ${active ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'}`} />
      <span className="flex-1">{item.label}</span>
      {active && <ChevronRight className="w-4 h-4 text-brand-500" />}
    </Link>
  )
}

function ComingSoonRow({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-400 cursor-not-allowed select-none">
      <Icon className="w-5 h-5 text-ink-300" />
      <span className="flex-1">{label}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-ink-100 text-ink-400">
        Em breve
      </span>
    </div>
  )
}
