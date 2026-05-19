'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle, Loader2, XCircle } from 'lucide-react'

declare global {
  interface Window {
    fbAsyncInit?: () => void
    FB?: {
      init: (config: object) => void
      login: (
        callback: (response: { authResponse?: { code?: string }; status: string }) => void,
        options: object,
      ) => void
    }
  }
}

type StepStatus = 'idle' | 'loading' | 'done' | 'error'

interface OnboardingStep {
  label: string
  status: StepStatus
  detail?: string
}

interface EmbeddedSignupProps {
  onSuccess?: (data: { wabaId: string; phoneNumberId: string; accessToken: string }) => void
}

export default function EmbeddedSignup({ onSuccess }: EmbeddedSignupProps) {
  const [sdkReady, setSdkReady] = useState(false)
  const [steps, setSteps] = useState<OnboardingStep[]>([
    { label: 'Autenticação via Facebook', status: 'idle' },
    { label: 'Troca de token de acesso', status: 'idle' },
    { label: 'Registro do número na Cloud API', status: 'idle' },
    { label: 'Inscrição em webhooks', status: 'idle' },
  ])

  const wabaIdRef = useRef<string>('')
  const phoneNumberIdRef = useRef<string>('')

  function setStep(index: number, patch: Partial<OnboardingStep>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  // Carrega o Facebook JS SDK
  useEffect(() => {
    if (document.getElementById('facebook-jssdk')) {
      setSdkReady(true)
      return
    }

    window.fbAsyncInit = () => {
      window.FB!.init({
        appId: process.env.NEXT_PUBLIC_META_APP_ID,
        autoLogAppEvents: true,
        xfbml: true,
        version: process.env.NEXT_PUBLIC_META_GRAPH_API_VERSION ?? 'v21.0',
      })
      setSdkReady(true)
    }

    const script = document.createElement('script')
    script.id = 'facebook-jssdk'
    script.src = 'https://connect.facebook.net/pt_BR/sdk.js'
    script.async = true
    script.defer = true
    document.body.appendChild(script)
  }, [])

  // Listener para o evento FINISH do Embedded Signup (captura WABA + phone IDs)
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== 'https://www.facebook.com') return
      try {
        const data = JSON.parse(event.data as string)
        if (data.type === 'WA_EMBEDDED_SIGNUP' && data.event === 'FINISH') {
          wabaIdRef.current = data.data?.waba_id ?? ''
          phoneNumberIdRef.current = data.data?.phone_number_id ?? ''
        }
      } catch {
        // ignora payloads não-JSON
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  async function handleLaunchSignup() {
    if (!window.FB) return

    setSteps([
      { label: 'Autenticação via Facebook', status: 'loading' },
      { label: 'Troca de token de acesso', status: 'idle' },
      { label: 'Registro do número na Cloud API', status: 'idle' },
      { label: 'Inscrição em webhooks', status: 'idle' },
    ])

    window.FB.login(
      async (response) => {
        const code = response.authResponse?.code

        if (!code) {
          setStep(0, { status: 'error', detail: 'Autenticação cancelada ou negada.' })
          return
        }
        setStep(0, { status: 'done', detail: 'Autenticado com sucesso.' })

        // Passo 1: trocar código por token
        setStep(1, { status: 'loading' })
        let accessToken: string
        try {
          const res = await fetch('/api/meta/exchange-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          accessToken = json.access_token
          setStep(1, { status: 'done', detail: 'Token de negócio obtido.' })
        } catch (err) {
          setStep(1, { status: 'error', detail: String(err) })
          return
        }

        // Passo 2: registrar número
        setStep(2, { status: 'loading' })
        const phoneNumberId = phoneNumberIdRef.current
        try {
          const res = await fetch('/api/meta/register-phone', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumberId, accessToken }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setStep(2, { status: 'done', detail: `Número registrado (ID: ${phoneNumberId}).` })
        } catch (err) {
          setStep(2, { status: 'error', detail: String(err) })
          return
        }

        // Passo 3: assinar webhooks
        setStep(3, { status: 'loading' })
        const wabaId = wabaIdRef.current
        try {
          const res = await fetch('/api/meta/subscribe-webhooks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ wabaId, accessToken }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setStep(3, { status: 'done', detail: `WABA ${wabaId} inscrita nos webhooks.` })
        } catch (err) {
          setStep(3, { status: 'error', detail: String(err) })
          return
        }

        onSuccess?.({ wabaId, phoneNumberId, accessToken })
      },
      {
        config_id: process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: {
          setup: {},
          featureType: '',
          sessionInfoVersion: '3',
        },
      },
    )
  }

  return (
    <div className="space-y-6">
      <button
        onClick={handleLaunchSignup}
        disabled={!sdkReady}
        className="inline-flex items-center gap-3 px-5 py-3 bg-[#1877F2] hover:bg-[#166FE5] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors shadow"
      >
        {/* Facebook icon */}
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
        </svg>
        Conectar com Facebook / WhatsApp Business
      </button>

      {steps.some((s) => s.status !== 'idle') && (
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="mt-0.5 shrink-0">
                {step.status === 'loading' && <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />}
                {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                {step.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                {step.status === 'idle' && <div className="w-4 h-4 rounded-full border-2 border-gray-300" />}
              </div>
              <div>
                <p className={`text-sm font-medium ${step.status === 'error' ? 'text-red-700' : 'text-gray-800'}`}>
                  {step.label}
                </p>
                {step.detail && (
                  <p className={`text-xs mt-0.5 ${step.status === 'error' ? 'text-red-500' : 'text-gray-500'}`}>
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
