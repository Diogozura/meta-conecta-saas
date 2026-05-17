import { login } from '@/lib/auth'
import { MessageSquare } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen bg-gradient-to-br from-green-50 to-gray-100">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-green-600 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Meta Conecta</h1>
          <p className="text-green-100 text-lg leading-relaxed">
            Plataforma de comunicação via WhatsApp Business API. Envie mensagens, gerencie clientes e automatize seu atendimento.
          </p>
          <div className="mt-10 space-y-3">
            {['Envio de mensagens em massa', 'Templates personalizados', 'Cadastro e gestão de clientes', 'Múltiplos números conectados'].map((f) => (
              <div key={f} className="flex items-center gap-3 text-green-100 text-sm">
                <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <span className="text-white text-xs">✓</span>
                </div>
                {f}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 justify-center mb-8">
            <div className="w-9 h-9 bg-green-600 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Meta Conecta</span>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Bem-vindo!</h2>
              <p className="text-sm text-gray-500 mt-1">Entre com suas credenciais para continuar</p>
            </div>

            <form action={login} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-offset-2"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
