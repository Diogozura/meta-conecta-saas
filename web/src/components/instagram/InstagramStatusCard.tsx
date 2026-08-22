'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'
import { InstagramGlyph } from '@/components/BrandIcons'

interface InstagramStatus {
  connected: boolean
  username?: string
  accountType?: string
  profilePictureUrl?: string
}

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
].join(',')

function buildAuthorizeUrl() {
  const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID
  const redirectUri = process.env.NEXT_PUBLIC_INSTAGRAM_REDIRECT_URI ?? 'https://www.zybot.com.br/api/instagram/callback'
  const url = new URL('https://www.instagram.com/oauth/authorize')
  url.searchParams.set('force_reauth', 'true')
  url.searchParams.set('client_id', appId ?? '')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPES)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    url.searchParams.set('state', crypto.randomUUID())
  }
  return url.toString()
}

interface InstagramStatusCardProps {
  /** 'full' = card completo (tela do Instagram); 'compact' = resumo somente leitura (Configurações). */
  variant?: 'full' | 'compact'
  /** Esconde o título "Conectar Instagram" e o parágrafo de explicação — usado onde a página já tem seu próprio cabeçalho (ex: aba "Visão geral"). */
  showHeader?: boolean
  /** Chamado depois de conectar/desconectar com sucesso — usado pela página do Instagram pra recarregar outras abas. */
  onStatusChange?: (status: InstagramStatus) => void
}

export default function InstagramStatusCard({ variant = 'full', showHeader = true, onStatusChange }: InstagramStatusCardProps) {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<InstagramStatus>({ connected: false })
  const [disconnecting, setDisconnecting] = useState(false)

  async function loadStatus() {
    try {
      const res = await fetch('/api/instagram/credentials')
      const data = await res.json()
      const c = data.credentials
      const next: InstagramStatus = {
        connected: !!c?.username,
        username: c?.username,
        accountType: c?.accountType,
        profilePictureUrl: c?.profilePictureUrl,
      }
      setStatus(next)
      onStatusChange?.(next)
    } catch (error) {
      console.error('Erro ao verificar conexão do Instagram:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    loadStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      const res = await fetch('/api/instagram/disconnect', { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao desconectar')
      toast.success('Instagram desconectado.')
      await loadStatus()
    } catch {
      toast.error('Erro ao desconectar o Instagram')
    } finally {
      setDisconnecting(false)
    }
  }

  const compact = variant === 'compact'

  if (loading) {
    return (
      <div className={compact ? 'space-y-3' : 'max-w-2xl space-y-4'}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className={compact ? 'h-24 w-full rounded-xl' : 'h-40 w-full rounded-xl'} />
      </div>
    )
  }

  const appId = process.env.NEXT_PUBLIC_INSTAGRAM_APP_ID
  const setupPendente = !appId
  const authorizeUrl = buildAuthorizeUrl()

  return (
    <div className={compact ? 'space-y-2' : 'max-w-2xl space-y-6'}>
      {!compact && showHeader && (
        <div>
          <h2 className="text-lg font-bold text-ink-900">Conectar Instagram</h2>
          <p className="text-sm text-ink-500 mt-1">
            Autorize o acesso à sua conta profissional do Instagram — mensagens, comentários, publicações e métricas ficam disponíveis no painel.
          </p>
        </div>
      )}

      {compact && <h3 className="text-sm font-semibold text-ink-800">Instagram</h3>}

      {status.connected && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-brand-800">Instagram conectado</h3>
          </div>
          <div className="flex items-center gap-3 bg-white rounded-lg border border-brand-200 p-3">
            {status.profilePictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto vem da CDN da Meta, sem domínio fixo pra configurar no next/image
              <img src={status.profilePictureUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-ink-100 flex items-center justify-center">
                <InstagramGlyph className="w-5 h-5 text-ink-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-ink-900">@{status.username}</p>
              {status.accountType && (
                <p className="text-xs text-ink-500">{status.accountType === 'BUSINESS' ? 'Conta comercial' : 'Conta de criador'}</p>
              )}
            </div>
          </div>
          {compact ? (
            <Link href="/dashboard/instagram" className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800">
              Gerenciar
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <RefreshCw className="w-4 h-4" />
              Desconectar
            </button>
          )}
        </div>
      )}

      {!status.connected && (
        <>
          {setupPendente ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                A integração com o Instagram ainda não foi configurada nessa instalação (falta a variável <code>NEXT_PUBLIC_INSTAGRAM_APP_ID</code>). Fale com o suporte do Zybot.
              </p>
            </div>
          ) : compact ? (
            <div className="bg-white rounded-xl border border-ink-200 p-4">
              <a
                href={authorizeUrl}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white text-sm font-semibold rounded-lg transition-opacity shadow"
              >
                <InstagramGlyph className="w-4 h-4" />
                Conectar Instagram
              </a>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-ink-200 p-6 space-y-4">
              <p className="text-sm text-ink-600">
                Clique no botão abaixo e faça login com a conta do Instagram — precisa ser uma conta comercial ou de criador (contas pessoais não funcionam). Você volta pro Zybot automaticamente depois de autorizar.
              </p>
              <a
                href={authorizeUrl}
                className="inline-flex items-center gap-3 px-5 py-3 bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white font-semibold rounded-lg transition-opacity shadow"
              >
                <InstagramGlyph className="w-5 h-5" />
                Conectar Instagram
              </a>
            </div>
          )}
        </>
      )}
    </div>
  )
}
