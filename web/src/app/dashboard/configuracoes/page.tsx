'use client'

import { useState, useEffect } from 'react'
import { Save, Eye, EyeOff, AlertCircle, CheckCircle, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { AGENT_PROVIDERS } from '@/lib/aiAgentTypes'

interface MetaCredentials {
  wabaId: string
  phoneNumberId: string
  businessToken: string
  appId: string
  appSecret: string
  webhookVerifyToken: string
  embeddedSignupConfigId?: string
}

interface AiConfig {
  enabled: boolean
  provider: 'gemini' | 'openai' | 'anthropic'
  model: string
  prompt: string
  apiKey: string
  informacoesNegocio: string
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

  const [aiConfig, setAiConfig] = useState<AiConfig>({ enabled: false, provider: 'gemini', model: 'gemini-2.0-flash', prompt: '', apiKey: '', informacoesNegocio: '' })
  const [aiLoading, setAiLoading] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

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

  async function loadAiConfig() {
    try {
      const res = await fetch('/api/conta/ai')
      if (res.ok) {
        const data = await res.json()
        if (data.ai) setAiConfig(data.ai)
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de IA:', error)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    loadCredentials()
    loadAiConfig()
  }, [])

  async function handleSaveAi(e: React.FormEvent) {
    e.preventDefault()
    setAiLoading(true)
    try {
      const res = await fetch('/api/conta/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiConfig),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      toast.success('Configuração do agente de IA salva.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar configuração de IA')
    } finally {
      setAiLoading(false)
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
    } catch (error: unknown) {
      console.error('Erro completo:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar credenciais')
    } finally {
      setLoading(false)
    }
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Configurações da Meta</h2>
        <p className="text-sm text-gray-500">
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
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
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono text-sm"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
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
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono text-sm"
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
              className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono text-sm"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent"
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
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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

      {/* Agente de IA */}
      <div className="pt-8 mt-8 border-t">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-green-600" />
          <h2 className="text-lg font-bold text-gray-900">Agente de IA</h2>
        </div>
        <p className="text-sm text-gray-500 mb-6">
          Quando ligado, a IA escolhida responde automaticamente as mensagens recebidas no WhatsApp — tira dúvidas sobre o negócio, consulta horários e cria agendamentos sozinha, e transfere pra um atendente humano quando não conseguir resolver.
        </p>

        <form onSubmit={handleSaveAi} className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={aiConfig.enabled}
              onChange={(e) => setAiConfig({ ...aiConfig, enabled: e.target.checked })}
            />
            Agente de IA ativo
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Provedor de IA</label>
            <select
              value={aiConfig.provider}
              onChange={(e) => {
                const provider = e.target.value as AiConfig['provider']
                const providerInfo = AGENT_PROVIDERS.find((p) => p.value === provider)
                setAiConfig({ ...aiConfig, provider, model: providerInfo?.modeloExemplo ?? aiConfig.model })
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm"
            >
              {AGENT_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">Escolha qual IA vai responder — cada empresa pode usar um provedor e uma chave diferente.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chave da API — {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.label}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono text-sm"
                placeholder="Cole sua chave aqui"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Sua própria chave — gere em {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.ondeConseguirChave}. Cada empresa usa a sua.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Modelo</label>
            <input
              type="text"
              value={aiConfig.model}
              onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent font-mono text-sm"
              placeholder={AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.modeloExemplo}
            />
            <p className="mt-1 text-xs text-gray-500">Ex: {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.modeloExemplo}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Informações do negócio</label>
            <textarea
              value={aiConfig.informacoesNegocio}
              onChange={(e) => setAiConfig({ ...aiConfig, informacoesNegocio: e.target.value })}
              rows={8}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm"
              placeholder={'Ex: Somos uma academia aberta de seg a sáb, das 6h às 22h...\nPlanos: mensal R$120, trimestral R$300...\nEndereço: Rua X, 123...\nDúvidas comuns: "posso trancar a matrícula?" — sim, por até 3 meses...'}
            />
            <p className="mt-1 text-xs text-gray-500">
              Descreva o negócio: o que vende ou atende (academia, loja, salão, oficina...), horário de funcionamento, endereço, preços, políticas e perguntas frequentes. O agente usa isso pra responder qualquer dúvida, não só sobre agendamento.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Prompt do agente</label>
            <textarea
              value={aiConfig.prompt}
              onChange={(e) => setAiConfig({ ...aiConfig, prompt: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-400 focus:border-transparent text-sm"
              placeholder="Instruções de como o agente deve se comportar..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Tom de voz e regras de comportamento — inclusive quando transferir pra um atendente humano.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={aiLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {aiLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Agente de IA
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
