'use client'

import { useEffect, useState } from 'react'
import EmbeddedSignup from '@/components/EmbeddedSignup'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { Skeleton } from '@/components/Skeleton'

interface OnboardedData {
  wabaId: string
  phoneNumberId: string
  accessToken: string
  coexistence: boolean
}

interface ConnectionStatus {
  connected: boolean
  wabaId?: string
  phoneNumberId?: string
  appId?: string
  appSecret?: string
  embeddedSignupConfigId?: string
  coexistence?: boolean
  desconectado?: boolean
}

export default function OnboardingPage() {
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false })
  const [reconnecting, setReconnecting] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadStatus() {
    try {
      const res = await fetch('/api/meta/credentials')
      const data = await res.json()
      const c = data.credentials
      setStatus({
        connected: !!(c?.wabaId && c?.phoneNumberId),
        wabaId: c?.wabaId,
        phoneNumberId: c?.phoneNumberId,
        appId: c?.appId,
        appSecret: c?.appSecret,
        embeddedSignupConfigId: c?.embeddedSignupConfigId,
        coexistence: !!c?.coexistence,
        desconectado: !!c?.desconectado,
      })
    } catch (error) {
      console.error('Erro ao verificar conexão do WhatsApp:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    loadStatus()
  }, [])

  async function handleOnboarded(data: OnboardedData) {
    setSaving(true)
    try {
      const res = await fetch('/api/meta/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wabaId: data.wabaId,
          phoneNumberId: data.phoneNumberId,
          businessToken: data.accessToken,
          appId: status.appId,
          appSecret: status.appSecret,
          embeddedSignupConfigId: status.embeddedSignupConfigId,
          coexistence: data.coexistence,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Erro ao salvar a conexão')
      toast.success('WhatsApp Business conectado com sucesso!')
      setReconnecting(false)
      await loadStatus()

      if (data.coexistence) {
        try {
          const syncRes = await fetch('/api/meta/sync-history', { method: 'POST' })
          const syncJson = await syncRes.json()
          if (!syncRes.ok) throw new Error(syncJson.error ?? 'Erro ao iniciar a sincronização')
          toast.success('Sincronização do histórico iniciada — as conversas antigas vão aparecer aos poucos.')
        } catch (syncError) {
          toast.error(syncError instanceof Error ? syncError.message : 'Erro ao iniciar a sincronização do histórico')
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar a conexão')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    )
  }

  const isFullyConnected = status.connected && !status.desconectado
  const showConnectFlow = !isFullyConnected || reconnecting
  const setupPendente = !status.appId || !status.appSecret

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Conectar WhatsApp Business</h2>
        <p className="text-sm text-ink-500 mt-1">
          Autorize o acesso à sua conta do WhatsApp Business em um clique — o número, os webhooks e o token de acesso ficam prontos automaticamente.
        </p>
      </div>

      {status.connected && status.desconectado && !reconnecting && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            Esse número foi desconectado pelo WhatsApp Business App no celular. Reconecte abaixo para voltar a enviar e receber mensagens.
          </p>
        </div>
      )}

      {isFullyConnected && !reconnecting && (
        <div className="bg-brand-50 border border-brand-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            <h3 className="font-semibold text-brand-800">WhatsApp conectado</h3>
            {status.coexistence && (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide bg-brand-600 text-white px-1.5 py-0.5 rounded">
                <Smartphone className="w-3 h-3" />
                Coexistência
              </span>
            )}
          </div>
          <p className="text-sm text-brand-700">
            {status.coexistence
              ? 'Esse número continua funcionando normalmente no app do celular — o Zybot só passa a enviar e receber mensagens em paralelo.'
              : 'Essa conta já está autorizada e pronta para enviar e receber mensagens.'}
          </p>
          <div className="bg-white rounded-lg border border-brand-200 p-3">
            <p className="text-xs font-mono font-bold text-ink-600">Número (Phone Number ID)</p>
            <p className="text-xs font-mono text-ink-800 mt-0.5">{status.phoneNumberId}</p>
          </div>
          <button
            onClick={() => setReconnecting(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <RefreshCw className="w-4 h-4" />
            Conectar outro número
          </button>
        </div>
      )}

      {showConnectFlow && (
        <>
          {setupPendente ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                Essa conta ainda não tem a integração com a Meta liberada. Fale com o suporte do Zybot para habilitar antes de conectar o WhatsApp.
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
              <div className="text-sm text-blue-700 space-y-1">
                <p className="font-semibold text-blue-800">Antes de começar</p>
                <p>Você precisa ser administrador do WhatsApp Business Account (WABA) que vai conectar, e o negócio precisa estar verificado na Meta.</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-ink-200 p-6 space-y-4">
            <p className="text-sm text-ink-600">
              Clique no botão abaixo e faça login com a conta do Facebook vinculada ao seu WhatsApp Business. Uma janela da Meta vai pedir a autorização — ao concluir, a conexão é salva automaticamente.
            </p>

            <EmbeddedSignup onSuccess={(data) => void handleOnboarded(data)} />

            {saving && <p className="text-xs text-ink-500">Salvando conexão...</p>}

            {isFullyConnected && reconnecting && (
              <button
                onClick={() => setReconnecting(false)}
                className="text-sm font-medium text-ink-500 hover:text-ink-700"
              >
                Cancelar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
