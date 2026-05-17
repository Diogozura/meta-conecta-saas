import Link from 'next/link'
import { MessageSquare, Users, FileText, PhoneCall, TrendingUp, ArrowRight } from 'lucide-react'

const stats = [
  { label: 'Mensagens Enviadas', value: '0', change: '—', icon: MessageSquare, color: 'bg-green-50 text-green-600' },
  { label: 'Clientes Cadastrados', value: '0', change: '—', icon: Users, color: 'bg-blue-50 text-blue-600' },
  { label: 'Templates Ativos', value: '0', change: '—', icon: FileText, color: 'bg-purple-50 text-purple-600' },
  { label: 'Números Conectados', value: '0', change: '—', icon: PhoneCall, color: 'bg-orange-50 text-orange-600' },
]

const quickLinks = [
  { href: '/dashboard/conversas', label: 'Ver Conversas', desc: 'Acesse o histórico de mensagens enviadas', icon: MessageSquare },
  { href: '/dashboard/clientes', label: 'Cadastro de Clientes', desc: 'Adicione e gerencie seus contatos', icon: Users },
  { href: '/dashboard/templates', label: 'Criar Template', desc: 'Monte mensagens reutilizáveis', icon: FileText },
  { href: '/dashboard/numeros', label: 'Adicionar Número', desc: 'Conecte um número do WhatsApp Business', icon: PhoneCall },
]

export default function DashboardPage() {
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
          {quickLinks.map((q) => {
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
