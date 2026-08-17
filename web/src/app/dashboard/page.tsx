import Link from 'next/link'
import { FileText, Plug, ArrowRight, Building2, Calendar } from 'lucide-react'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import { WhatsAppGlyph } from '@/components/BrandIcons'

const stats = [
  { label: 'Mensagens enviadas', value: '0', icon: WhatsAppGlyph, color: 'bg-brand-50 text-brand-600' },
  { label: 'Agendamentos hoje', value: '0', icon: Calendar, color: 'bg-accent-50 text-accent-600' },
  { label: 'Templates ativos', value: '0', icon: FileText, color: 'bg-blue-50 text-blue-600' },
  { label: 'Números conectados', value: '0', icon: Plug, color: 'bg-orange-50 text-orange-600' },
]

const quickLinks = [
  { href: '/dashboard/conversas', label: 'Conversas', desc: 'Veja e responda suas conversas do WhatsApp', icon: WhatsAppGlyph, platformAdminOnly: false },
  { href: '/dashboard/agenda', label: 'Agenda', desc: 'Confira o calendário e os próximos agendamentos', icon: Calendar, platformAdminOnly: false },
  { href: '/dashboard/clientes', label: 'Gerenciar empresas', desc: 'Cadastre e administre as contas de clientes do SaaS', icon: Building2, platformAdminOnly: true },
]

export default async function DashboardPage() {
  const { isPlatformAdmin } = await getSessionWithPlatformAdmin()
  const visibleQuickLinks = quickLinks.filter((q) => !q.platformAdminOnly || isPlatformAdmin)

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Stats */}
      <div data-tour="dash-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-ink-200 p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-ink-900 leading-none">{s.value}</p>
                <p className="text-xs text-ink-500 mt-1 truncate">{s.label}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick access */}
      <div data-tour="dash-quicklinks">
        <h2 className="text-base font-semibold text-ink-800 mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleQuickLinks.map((q) => {
            const Icon = q.icon
            return (
              <Link
                key={q.href}
                href={q.href}
                className="bg-white rounded-xl border border-ink-200 p-5 hover:border-brand-400 hover:shadow-sm transition-all group flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-ink-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-brand-50 transition-colors">
                  <Icon className="w-5 h-5 text-ink-500 group-hover:text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink-800 text-sm">{q.label}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{q.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 mt-0.5 transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
