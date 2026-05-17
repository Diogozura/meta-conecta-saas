'use client'

import { useState } from 'react'
import EmbeddedSignup from '@/components/EmbeddedSignup'
import { CheckCircle, Copy } from 'lucide-react'

interface OnboardedData {
  wabaId: string
  phoneNumberId: string
  accessToken: string
}

export default function OnboardingPage() {
  const [result, setResult] = useState<OnboardedData | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  function copyToClipboard(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Conectar conta WhatsApp Business</h2>
        <p className="text-sm text-gray-500 mt-1">
          Use o Embedded Signup do Meta para autorizar sua conta WhatsApp Business e obter acesso à Cloud API.
        </p>
      </div>

      {/* Pré-requisitos */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-blue-800">Antes de começar</p>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Configure <code className="bg-blue-100 px-1 rounded text-xs">NEXT_PUBLIC_META_APP_ID</code> e <code className="bg-blue-100 px-1 rounded text-xs">NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID</code> no <code className="bg-blue-100 px-1 rounded text-xs">.env.local</code></li>
          <li>Seu app Meta deve ter o WhatsApp use case habilitado</li>
          <li>O negócio no Meta deve estar verificado (<a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/solution-providers/get-started-for-tech-providers" target="_blank" rel="noopener noreferrer" className="underline">saiba mais</a>)</li>
          <li>Após o onboarding, salve os dados abaixo no seu <code className="bg-blue-100 px-1 rounded text-xs">.env.local</code></li>
        </ul>
      </div>

      {/* Fluxo Embedded Signup */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">1</div>
          <h3 className="font-semibold text-gray-800">Autenticar com Meta</h3>
        </div>
        <p className="text-sm text-gray-600">
          Clique no botão abaixo. Uma janela do Facebook será aberta para você autorizar o acesso ao seu WhatsApp Business Account (WABA). Ao finalizar, o sistema automaticamente troca o token, registra o número e assina os webhooks.
        </p>

        <EmbeddedSignup
          onSuccess={(data) => setResult(data)}
        />
      </div>

      {/* Resultado do onboarding */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-green-800">Onboarding concluído!</h3>
          </div>
          <p className="text-sm text-green-700">
            Salve os valores abaixo no seu <code className="bg-green-100 px-1 rounded">.env.local</code>:
          </p>

          <div className="space-y-2">
            {[
              { key: 'META_PHONE_NUMBER_ID', value: result.phoneNumberId },
              { key: 'META_BUSINESS_TOKEN', value: result.accessToken },
            ].map(({ key, value }) => (
              <div key={key} className="bg-white rounded-lg border border-green-200 p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-gray-600">{key}</p>
                  <p className="text-xs font-mono text-gray-800 truncate mt-0.5">{value}</p>
                </div>
                <button
                  onClick={() => copyToClipboard(value, key)}
                  className="p-1.5 rounded text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors shrink-0"
                  title="Copiar"
                >
                  {copied === key
                    ? <CheckCircle className="w-4 h-4 text-green-500" />
                    : <Copy className="w-4 h-4" />
                  }
                </button>
              </div>
            ))}
            <div className="bg-white rounded-lg border border-green-200 p-3">
              <p className="text-xs font-mono font-bold text-gray-600">WABA ID (referência)</p>
              <p className="text-xs font-mono text-gray-800 mt-0.5">{result.wabaId}</p>
            </div>
          </div>
        </div>
      )}

      {/* Webhook info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-green-100 rounded-full flex items-center justify-center text-xs font-bold text-green-700">2</div>
          <h3 className="font-semibold text-gray-800">Configurar Webhook no Meta App Dashboard</h3>
        </div>
        <p className="text-sm text-gray-600">
          No <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">App Dashboard</a>, vá em <strong>WhatsApp → Configuration</strong> e configure:
        </p>
        <div className="space-y-2">
          <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700 break-all">
            <span className="text-gray-500">Callback URL: </span>https://seu-dominio.com/api/webhook
          </div>
          <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700">
            <span className="text-gray-500">Verify Token: </span>
            <span className="text-orange-600">{'{META_WEBHOOK_VERIFY_TOKEN do .env.local}'}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Inscreva-se nos campos: <code>messages</code>, <code>message_template_status_update</code>, <code>phone_number_quality_update</code>
        </p>
      </div>
    </div>
  )
}
