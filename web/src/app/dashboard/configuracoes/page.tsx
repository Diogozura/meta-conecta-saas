'use client'

import { useState, useEffect } from 'react'
import { Save, Key, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface MetaCredentials {
  wabaId: string
  phoneNumberId: string
  businessToken: string
  appId: string
  appSecret: string
  webhookVerifyToken: string
  embeddedSignupConfigId?: string
}

export default function ConfiguracoesPage() {
  const [credentials, setCredentials] = useState<MetaCredentials>({
    wabaId: '',
    phoneNumberId: '',
    businessToken: '',
    appId: '',
    appSecret: '',
    webhookVerifyToken: '',
    embeddedSignupConfigId: '',
  })
  const [showTokens, setShowTokens] = useState({
    businessToken: false,
    appSecret: false,
    webhookVerifyToken: false,
  })
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [hasCredentials, setHasCredentials] = useState(false)

  useEffect(() => {
    loadCredentials()
  }, [])

  async function loadCredentials() {
    try {
      const res = await fetch('/api/meta/credentials')
      if (res.ok) {
        const data = await res.json()
        if (data.credentials) {
          setCredentials(data.credentials)
          setHasCredentials(true)
        }
      }
    } catch (error) {
      console.error('Erro ao carregar credenciais:', error)
    } finally {
      setLoadingData(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/meta/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
      })

      const contentType = res.headers.get('content-type')
      
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text()
        console.error('Resposta não é JSON:', text)
        throw new Error('Erro no servidor. Verifique o console do terminal.')
      }

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar')
      }

      toast.success(data.message || '✅ Credenciais salvas com sucesso!')
      setHasCredentials(true)
    } catch (error: any) {
      console.error('Erro completo:', error)
      toast.error(error.message || 'Erro ao salvar credenciais')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Configurações da Meta</h1>
        <p className="text-gray-600">
          Configure as credenciais de acesso à API do WhatsApp Business
        </p>
      </div>

      {hasCredentials && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-green-900">Credenciais configuradas</p>
            <p className="text-sm text-green-700">
              Sua conta está conectada ao WhatsApp Business API
            </p>
          </div>
        </div>
      )}

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
        <div className="text-sm text-yellow-800">
          <p className="font-medium mb-1">⚠️ Informações sensíveis</p>
          <p>
            Essas credenciais são armazenadas de forma segura no Firebase. Nunca compartilhe
            seus tokens de acesso.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* WABA ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WABA ID (WhatsApp Business Account ID)
          </label>
          <input
            type="text"
            required
            value={credentials.wabaId}
            onChange={(e) => setCredentials({ ...credentials, wabaId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: 1283278710593625"
          />
          <p className="mt-1 text-xs text-gray-500">
            Encontre em: Meta App Dashboard → WhatsApp → Getting Started
          </p>
        </div>

        {/* Phone Number ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Phone Number ID
          </label>
          <input
            type="text"
            required
            value={credentials.phoneNumberId}
            onChange={(e) => setCredentials({ ...credentials, phoneNumberId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: 1026009683939150"
          />
          <p className="mt-1 text-xs text-gray-500">
            ID do número de telefone vinculado ao WhatsApp Business
          </p>
        </div>

        {/* Business Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Access Token
          </label>
          <div className="relative">
            <input
              type={showTokens.businessToken ? 'text' : 'password'}
              required
              value={credentials.businessToken}
              onChange={(e) => setCredentials({ ...credentials, businessToken: e.target.value })}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="EAAerrWvlQ9YBR..."
            />
            <button
              type="button"
              onClick={() => setShowTokens({ ...showTokens, businessToken: !showTokens.businessToken })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showTokens.businessToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Token obtido após completar o Embedded Signup
          </p>
        </div>

        {/* App ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            App ID
          </label>
          <input
            type="text"
            required
            value={credentials.appId}
            onChange={(e) => setCredentials({ ...credentials, appId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: 2159086164853718"
          />
          <p className="mt-1 text-xs text-gray-500">
            ID do seu aplicativo Meta (público)
          </p>
        </div>

        {/* App Secret */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            App Secret
          </label>
          <div className="relative">
            <input
              type={showTokens.appSecret ? 'text' : 'password'}
              required
              value={credentials.appSecret}
              onChange={(e) => setCredentials({ ...credentials, appSecret: e.target.value })}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="b4f94227169acf3..."
            />
            <button
              type="button"
              onClick={() => setShowTokens({ ...showTokens, appSecret: !showTokens.appSecret })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showTokens.appSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Chave secreta do aplicativo (NUNCA compartilhe)
          </p>
        </div>

        {/* Webhook Verify Token */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Webhook Verify Token
          </label>
          <div className="relative">
            <input
              type={showTokens.webhookVerifyToken ? 'text' : 'password'}
              required
              value={credentials.webhookVerifyToken}
              onChange={(e) => setCredentials({ ...credentials, webhookVerifyToken: e.target.value })}
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              placeholder="wls573lkDuo..."
            />
            <button
              type="button"
              onClick={() => setShowTokens({ ...showTokens, webhookVerifyToken: !showTokens.webhookVerifyToken })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showTokens.webhookVerifyToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Token usado para verificar webhooks (mesmo definido no App Dashboard)
          </p>
        </div>

        {/* Embedded Signup Config ID */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Embedded Signup Config ID
            <span className="ml-2 text-xs font-normal text-gray-500">(Opcional)</span>
          </label>
          <input
            type="text"
            value={credentials.embeddedSignupConfigId || ''}
            onChange={(e) => setCredentials({ ...credentials, embeddedSignupConfigId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Ex: 1003224562191203"
          />
          <p className="mt-1 text-xs text-gray-500">
            Configuration ID do Embedded Signup (criado no App Dashboard)
          </p>
        </div>

        {/* Botão Salvar */}
        <div className="flex justify-end pt-6 border-t">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Credenciais
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
