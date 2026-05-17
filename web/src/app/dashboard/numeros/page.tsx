import { Plus, PhoneCall, CheckCircle, XCircle, MoreHorizontal } from 'lucide-react'

const numbers = [
  { display: '+55 11 99000-0001', name: 'Suporte', status: 'Conectado', since: '01/05/2026' },
  { display: '+55 21 98000-0002', name: 'Vendas', status: 'Pendente', since: '10/05/2026' },
]

const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
  Conectado: { color: 'bg-green-50 text-green-700', icon: CheckCircle },
  Pendente: { color: 'bg-yellow-50 text-yellow-700', icon: XCircle },
  Desconectado: { color: 'bg-red-50 text-red-700', icon: XCircle },
}

export default function NumerosPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Números de WhatsApp</h2>
          <p className="text-sm text-gray-500">Conecte e gerencie seus números do WhatsApp Business</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <Plus className="w-4 h-4" />
          Adicionar Número
        </button>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Conectar Novo Número</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Número (com DDD)</label>
            <input
              type="text"
              placeholder="Ex: 5511999990000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Perfil</label>
            <input
              type="text"
              placeholder="Ex: Suporte"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>
          <div className="flex items-end">
            <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors w-full justify-center">
              <PhoneCall className="w-4 h-4" />
              Conectar
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-400">A integração real com a API da Meta será configurada em breve.</p>
      </div>

      {/* Numbers list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {numbers.map((n, i) => {
          const cfg = statusConfig[n.status] ?? statusConfig['Desconectado']
          const StatusIcon = cfg.icon
          return (
            <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <PhoneCall className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{n.display}</p>
                <p className="text-xs text-gray-500 mt-0.5">{n.name} · Desde {n.since}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 shrink-0 ${cfg.color}`}>
                <StatusIcon className="w-3 h-3" />{n.status}
              </span>
              <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ml-2">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
          )
        })}
        {numbers.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhum número conectado ainda.</div>
        )}
      </div>
    </div>
  )
}
