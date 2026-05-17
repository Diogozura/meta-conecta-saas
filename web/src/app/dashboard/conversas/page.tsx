import { MessageSquare, Search, Filter, Clock } from 'lucide-react'
import SendMessageForm from './SendMessageForm'

const conversations = [
  { name: 'João Silva', number: '+55 11 99999-0001', last: 'Olá! Gostaria de mais informações.', time: '10:32', status: 'Recebida' },
  { name: 'Maria Costa', number: '+55 21 98888-0002', last: 'Obrigada pelo atendimento!', time: '09:15', status: 'Enviada' },
  { name: 'Pedro Alves', number: '+55 31 97777-0003', last: 'Quando estará disponível?', time: 'Ontem', status: 'Recebida' },
]

export default function ConversasPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Conversas</h2>
          <p className="text-sm text-gray-500">Histórico de mensagens enviadas e recebidas</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <MessageSquare className="w-4 h-4" />
          Nova Mensagem
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nome ou número..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          Filtrar
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {conversations.map((c, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 cursor-pointer transition-colors">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
              <span className="text-sm font-bold text-green-700">{c.name[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0 ml-2">
                  <Clock className="w-3 h-3" />{c.time}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{c.number} — {c.last}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${c.status === 'Recebida' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
              {c.status}
            </span>
          </div>
        ))}
        {conversations.length === 0 && (
          <div className="py-16 text-center text-gray-400 text-sm">Nenhuma conversa encontrada.</div>
        )}
      </div>

      {/* Envio de mensagem */}
      <SendMessageForm />
    </div>
  )
}
