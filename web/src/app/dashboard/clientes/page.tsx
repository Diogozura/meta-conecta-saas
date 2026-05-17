import { UserPlus, Search, Phone, Mail, MoreHorizontal } from 'lucide-react'

const clients = [
  { name: 'João Silva', email: 'joao@email.com', phone: '+55 11 99999-0001', tag: 'Lead' },
  { name: 'Maria Costa', email: 'maria@email.com', phone: '+55 21 98888-0002', tag: 'Cliente' },
  { name: 'Pedro Alves', email: 'pedro@email.com', phone: '+55 31 97777-0003', tag: 'Inativo' },
]

const tagColors: Record<string, string> = {
  Lead: 'bg-yellow-50 text-yellow-700',
  Cliente: 'bg-green-50 text-green-700',
  Inativo: 'bg-gray-100 text-gray-500',
}

export default function ClientesPage() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500">Gerencie seus contatos e clientes</p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors">
          <UserPlus className="w-4 h-4" />
          Adicionar Cliente
        </button>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nome</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contato</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Tag</th>
              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c, i) => (
              <tr key={i} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-green-700">{c.name[0]}</span>
                    </div>
                    <span className="font-medium text-gray-900">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1.5 text-gray-600"><Phone className="w-3 h-3 text-gray-400" />{c.phone}</span>
                    <span className="flex items-center gap-1.5 text-gray-500"><Mail className="w-3 h-3 text-gray-400" />{c.email}</span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tagColors[c.tag] ?? 'bg-gray-100 text-gray-500'}`}>{c.tag}</span>
                </td>
                <td className="px-5 py-3 text-right">
                  <button className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
