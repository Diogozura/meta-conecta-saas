'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { setSession } from '@/lib/auth'
import { MessageSquare, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/Logo'

const googleProvider = new GoogleAuthProvider()

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  // Login em 2 passos quando a conta tem 2FA ativo — guarda o idToken já
  // validado pelo Firebase enquanto espera o código do app autenticador.
  const [pendingIdToken, setPendingIdToken] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState('')

  async function handleSession(idToken: string, totpCode?: string) {
    const result = await setSession(idToken, totpCode)
    if (result.success) {
      router.push('/dashboard')
      return
    }
    if (result.requiresTotp) {
      setPendingIdToken(idToken)
      setError(result.error ?? '')
      return
    }
    setError(result.error ?? 'Erro ao autenticar.')
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!pendingIdToken || totpCode.trim().length !== 6) return
    setLoading(true)
    setError('')
    await handleSession(pendingIdToken, totpCode.trim())
    setLoading(false)
  }

  async function handleEmailLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const form = e.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      await handleSession(await credential.user.getIdToken())
    } catch {
      setError('Email ou senha incorretos.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setLoading(true)
    setError('')
    try {
      const credential = await signInWithPopup(auth, googleProvider)
      await handleSession(await credential.user.getIdToken())
    } catch {
      setError('Falha ao entrar com Google. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-brand-50 to-ink-100">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-brand-600 flex-col items-center justify-center p-12 text-white">
        <div className="max-w-md">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-8">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Zybot</h1>
          <p className="text-brand-100 text-lg leading-relaxed">
            Sua central de atendimento, agenda e automação com IA — WhatsApp hoje, Instagram e Facebook em breve, tudo em um só lugar.
          </p>
          <div className="mt-10 space-y-3">
            {['Envio de mensagens em massa', 'Templates personalizados', 'Cadastro e gestão de clientes', 'Múltiplos números conectados'].map((f) => (
              <div key={f} className="flex items-center gap-3 text-brand-100 text-sm">
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
          <div className="lg:hidden flex items-center justify-center mb-8">
            <Logo markClassName="w-9 h-9" textClassName="text-xl font-bold text-ink-900" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-ink-200 p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-ink-900">Bem-vindo!</h2>
              <p className="text-sm text-ink-500 mt-1">Entre com suas credenciais para continuar</p>
            </div>

            {error && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {pendingIdToken ? (
              <form onSubmit={handleTotpSubmit} className="space-y-4">
                <div className="flex items-center gap-2 text-ink-700">
                  <ShieldCheck className="w-5 h-5 text-brand-600 shrink-0" />
                  <p className="text-sm">Abra seu app autenticador e digite o código de 6 dígitos.</p>
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                  disabled={loading}
                  className="w-full px-3 py-2.5 border border-ink-300 rounded-lg text-center text-lg tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50"
                  placeholder="000000"
                />
                <button
                  type="submit"
                  disabled={loading || totpCode.length !== 6}
                  className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Verificar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPendingIdToken(null)
                    setTotpCode('')
                    setError('')
                  }}
                  className="w-full text-center text-sm text-ink-500 hover:text-ink-700"
                >
                  Voltar
                </button>
              </form>
            ) : (
              <>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Email</label>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  disabled={loading}
                  className="w-full px-3 py-2.5 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50"
                  placeholder="seu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-1">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    required
                    autoComplete="current-password"
                    disabled={loading}
                    className="w-full px-3 py-2.5 pr-10 border border-ink-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition disabled:opacity-50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Entrar
              </button>
            </form>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ink-200" />
              </div>
              <div className="relative flex justify-center text-xs text-ink-400">
                <span className="bg-white px-2">ou continue com</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full py-2.5 px-4 border border-ink-300 hover:bg-ink-50 text-ink-700 text-sm font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Entrar com Google
            </button>

            <p className="mt-6 text-center text-sm text-ink-500">
              Não tem uma conta?{' '}
              <Link href="/cadastro" className="font-medium text-brand-700 hover:text-brand-800">
                Cadastre-se
              </Link>
            </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

