import Link from 'next/link'
import { MessageSquare, Users, FileText, Plug, TrendingUp, ArrowRight, Building2 } from 'lucide-react'
import { getSessionWithPlatformAdmin } from '@/lib/auth'

const stats = [
  { label: 'Mensagens Enviadas', value: '0', change: '—', icon: MessageSquare, color: 'bg-green-50 text-green-600' },
  { label: 'Clientes Cadastrados', value: '0', change: '—', icon: Users, color: 'bg-blue-50 text-blue-600' },
  { label: 'Templates Ativos', value: '0', change: '—', icon: FileText, color: 'bg-purple-50 text-purple-600' },
  { label: 'Números Conectados', value: '0', change: '—', icon: Plug, color: 'bg-orange-50 text-orange-600' },
]

const quickLinks = [
  { href: '/dashboard/conversas', label: 'Ver Conversas', desc: 'Acesse o histórico de mensagens enviadas', icon: MessageSquare, platformAdminOnly: false },
  { href: '/dashboard/templates', label: 'Criar Template', desc: 'Monte mensagens reutilizáveis', icon: FileText, platformAdminOnly: false },
  { href: '/dashboard/onboarding', label: 'Conectar WABA', desc: 'Conecte um número do WhatsApp Business', icon: Plug, platformAdminOnly: false },
  { href: '/dashboard/clientes', label: 'Gerenciar Empresas', desc: 'Cadastre e administre as contas de clientes do SaaS', icon: Building2, platformAdminOnly: true },
]

export default async function DashboardPage() {
  const { isPlatformAdmin } = await getSessionWithPlatformAdmin()
  const visibleQuickLinks = quickLinks.filter((q) => !q.platformAdminOnly || isPlatformAdmin)

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />{s.change}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick access */}
      <div>
        <h2 className="text-base font-semibold text-gray-800 mb-3">Acesso Rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleQuickLinks.map((q) => {
            const Icon = q.icon
            return (
              <Link
                key={q.href}
                href={q.href}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:border-green-400 hover:shadow-sm transition-all group flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-green-50 transition-colors">
                  <Icon className="w-5 h-5 text-gray-500 group-hover:text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">{q.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{q.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 mt-0.5 transition-colors" />
              </Link>
            )
          })}
        </div>
      </div>

      {/* Info */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800">
        <strong>Integração com a API da Meta</strong> — A conectividade real com o WhatsApp Business será configurada em breve.
      </div>
    </div>
  )
}
