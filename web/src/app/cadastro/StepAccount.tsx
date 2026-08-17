import type { CadastroFormData } from './types'

interface StepAccountProps {
  formData: CadastroFormData
  updateField: (key: keyof CadastroFormData, value: string) => void
  onContinue: () => void
  onGoogleSignup: () => void
  loading: boolean
}

export default function StepAccount({ formData, updateField, onContinue, onGoogleSignup, loading }: StepAccountProps) {
  return (
    <div>
      <button
        type="button"
        onClick={onGoogleSignup}
        disabled={loading}
        className="w-full py-2.5 px-4 border border-ink-300 hover:bg-ink-50 text-ink-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        Cadastrar com Google
      </button>

      <div className="relative my-5">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-ink-200" />
        </div>
        <div className="relative flex justify-center text-xs text-ink-400">
          <span className="bg-white px-2">ou continue com email</span>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); onContinue() }} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Nome completo</label>
          <input
            type="text"
            required
            autoComplete="name"
            disabled={loading}
            value={formData.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="w-full px-3 py-2.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50"
            placeholder="Seu nome completo"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
          <input
            type="email"
            required
            autoComplete="email"
            disabled={loading}
            value={formData.email}
            onChange={(e) => updateField('email', e.target.value)}
            className="w-full px-3 py-2.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50"
            placeholder="seu@email.com"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continuar
        </button>
      </form>
    </div>
  )
}
