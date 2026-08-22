'use client'

import { useState, useEffect, type ComponentType } from 'react'
import { Save, Eye, EyeOff, AlertCircle, AlertTriangle, Sparkles, SlidersHorizontal, FileText, UserCog, Plug, ExternalLink, Gauge } from 'lucide-react'
import { toast } from 'sonner'
import { AGENT_PROVIDERS } from '@/lib/aiAgentTypes'
import { Skeleton } from '@/components/Skeleton'
import { InstagramGlyph } from '@/components/BrandIcons'
import InstagramStatusCard from '@/components/instagram/InstagramStatusCard'
import TemplatesPage from '../templates/page'
import UsuariosPage from '../usuarios/page'
import OnboardingPage from '../onboarding/page'

type ConfigTab = 'geral' | 'templates' | 'usuarios' | 'onboarding' | 'instagram'

const configTabs: { key: ConfigTab; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'geral', label: 'Geral', icon: SlidersHorizontal },
  { key: 'templates', label: 'Templates', icon: FileText },
  { key: 'usuarios', label: 'Usuários', icon: UserCog },
  { key: 'onboarding', label: 'Conectar WABA', icon: Plug },
  { key: 'instagram', label: 'Instagram', icon: InstagramGlyph },
]

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<ConfigTab>('geral')

  return (
    <div className="max-w-5xl">
      <div className="mb-2">
        <h1 className="text-lg font-bold text-ink-900">Configurações</h1>
        <p className="text-sm text-ink-500">Credenciais da Meta, agente de IA, templates, usuários e a conexão do WhatsApp — tudo em um só lugar.</p>
      </div>

      <div data-tour="config-tabs" className="flex items-center gap-1 border-b border-ink-200 mb-6 mt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
        {configTabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                active ? 'border-brand-600 text-brand-700' : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'geral' && <GeneralSettingsTab />}
      {tab === 'templates' && <TemplatesPage />}
      {tab === 'usuarios' && <UsuariosPage />}
      {tab === 'onboarding' && <OnboardingPage />}
      {tab === 'instagram' && <InstagramStatusCard variant="full" />}
    </div>
  )
}

interface AiConfig {
  enabled: boolean
  provider: 'gemini' | 'openai' | 'anthropic'
  model: string
  prompt: string
  apiKey: string
  informacoesNegocio: string
  ultimoErro?: string
  ultimoErroEm?: string
}

interface UsoAgenteIA {
  hoje: number
  mes: number
  ultimos30Dias: number
}

function GeneralSettingsTab() {
  const [loadingData, setLoadingData] = useState(true)
  const [aiConfig, setAiConfig] = useState<AiConfig>({ enabled: false, provider: 'gemini', model: 'gemini-2.5-flash', prompt: '', apiKey: '', informacoesNegocio: '' })
  const [aiLoading, setAiLoading] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [uso, setUso] = useState<UsoAgenteIA | null>(null)

  async function loadAiConfig() {
    try {
      const res = await fetch('/api/conta/ai')
      if (res.ok) {
        const data = await res.json()
        if (data.ai) setAiConfig(data.ai)
      }
    } catch (error) {
      console.error('Erro ao carregar configuração de IA:', error)
    } finally {
      setLoadingData(false)
    }
  }

  async function loadUso() {
    try {
      const res = await fetch('/api/conta/ai/uso')
      if (res.ok) setUso(await res.json())
    } catch (error) {
      console.error('Erro ao carregar uso do agente de IA:', error)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mesmo padrão usado nas demais telas do dashboard
    loadAiConfig()
    loadUso()
  }, [])

  const provedorAtual = AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)
  const erroEhLimite = !!aiConfig.ultimoErro && /limite de uso|rate limit/i.test(aiConfig.ultimoErro)

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

  if (loadingData) {
    return (
      <div className="max-w-4xl space-y-5">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5 rounded" />
          <Skeleton className="h-5 w-32" />
        </div>
        <Skeleton className="h-4 w-full max-w-lg" />
        <Skeleton className="h-5 w-40" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Agente de IA */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5 text-brand-600" />
          <h2 className="text-lg font-bold text-ink-900">Agente de IA</h2>
        </div>
        <p className="text-sm text-ink-500 mb-6">
          Quando ligado, a IA escolhida responde automaticamente as mensagens recebidas no WhatsApp — tira dúvidas sobre o negócio, consulta horários e cria agendamentos sozinha, e transfere pra um atendente humano quando não conseguir resolver.
        </p>

        {aiConfig.enabled && aiConfig.ultimoErro && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            {erroEhLimite ? (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            )}
            <div className="text-sm">
              <p className="font-medium text-red-900 flex items-center gap-2 flex-wrap">
                {erroEhLimite ? 'Limite de uso atingido' : 'O agente está ativo, mas a última tentativa de responder falhou'}
                {erroEhLimite && <span className="text-[10px] font-semibold uppercase tracking-wide bg-red-600 text-white px-1.5 py-0.5 rounded">rate limit</span>}
              </p>
              <p className="text-red-700 mt-0.5">{aiConfig.ultimoErro}</p>
              {aiConfig.ultimoErroEm && (
                <p className="text-red-500 text-xs mt-1">
                  {new Date(aiConfig.ultimoErroEm).toLocaleString('pt-BR')}
                </p>
              )}
              <p className="text-red-700 mt-1">Verifique a chave de API do provedor abaixo — clientes podem não estar recebendo resposta.</p>
            </div>
          </div>
        )}

        {aiConfig.enabled && (
          <div className="mb-6 p-4 bg-ink-50 border border-ink-200 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-ink-500" />
              <p className="text-sm font-medium text-ink-800">Uso do agente</p>
            </div>
            {uso ? (
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div>
                  <p className="text-ink-900 font-semibold">{uso.hoje}</p>
                  <p className="text-xs text-ink-500">mensagens hoje</p>
                </div>
                <div>
                  <p className="text-ink-900 font-semibold">{uso.mes}</p>
                  <p className="text-xs text-ink-500">mensagens este mês</p>
                </div>
                <div>
                  <p className="text-ink-900 font-semibold">{uso.ultimos30Dias}</p>
                  <p className="text-xs text-ink-500">últimos 30 dias</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-ink-400">Carregando...</p>
            )}
            <p className="text-xs text-ink-500 mt-3">
              Essa é uma contagem própria do Zybot (quantas vezes o agente chamou a IA) — não é a cota oficial do provedor, já que
              {' '}{provedorAtual?.label ?? 'o provedor'} não expõe isso pela chave de API comum. Pra ver o consumo/limite exato da sua chave, acesse o painel do provedor.
            </p>
            {provedorAtual && (
              <a
                href={provedorAtual.ondeVerUso}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-brand-700 hover:underline"
              >
                Ver uso real em {provedorAtual.label} <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        <form onSubmit={handleSaveAi} className="space-y-5">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input
              type="checkbox"
              checked={aiConfig.enabled}
              onChange={(e) => setAiConfig({ ...aiConfig, enabled: e.target.checked })}
            />
            Agente de IA ativo
          </label>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">Provedor de IA</label>
            <select
              value={aiConfig.provider}
              onChange={(e) => {
                const provider = e.target.value as AiConfig['provider']
                const providerInfo = AGENT_PROVIDERS.find((p) => p.value === provider)
                setAiConfig({ ...aiConfig, provider, model: providerInfo?.modeloExemplo ?? aiConfig.model })
              }}
              className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
            >
              {AGENT_PROVIDERS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-ink-500">Escolha qual IA vai responder — cada empresa pode usar um provedor e uma chave diferente.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">
              Chave da API — {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.label}
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={aiConfig.apiKey}
                onChange={(e) => setAiConfig({ ...aiConfig, apiKey: e.target.value })}
                className="w-full px-4 py-2 pr-12 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent font-mono text-sm"
                placeholder="Cole sua chave aqui"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
              >
                {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-ink-500">
              Sua própria chave — gere em {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.ondeConseguirChave}. Cada empresa usa a sua.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">Modelo</label>
            <input
              type="text"
              value={aiConfig.model}
              onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
              className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent font-mono text-sm"
              placeholder={AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.modeloExemplo}
            />
            <p className="mt-1 text-xs text-ink-500">Ex: {AGENT_PROVIDERS.find((p) => p.value === aiConfig.provider)?.modeloExemplo}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">Informações do negócio</label>
            <textarea
              value={aiConfig.informacoesNegocio}
              onChange={(e) => setAiConfig({ ...aiConfig, informacoesNegocio: e.target.value })}
              rows={8}
              className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
              placeholder={'Ex: Somos uma academia aberta de seg a sáb, das 6h às 22h...\nPlanos: mensal R$120, trimestral R$300...\nEndereço: Rua X, 123...\nDúvidas comuns: "posso trancar a matrícula?" — sim, por até 3 meses...'}
            />
            <p className="mt-1 text-xs text-ink-500">
              Descreva o negócio: o que vende ou atende (academia, loja, salão, oficina...), horário de funcionamento, endereço, preços, políticas e perguntas frequentes. O agente usa isso pra responder qualquer dúvida, não só sobre agendamento.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink-700 mb-2">Prompt do agente</label>
            <textarea
              value={aiConfig.prompt}
              onChange={(e) => setAiConfig({ ...aiConfig, prompt: e.target.value })}
              rows={6}
              className="w-full px-4 py-2 border border-ink-300 rounded-lg focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
              placeholder="Instruções de como o agente deve se comportar..."
            />
            <p className="mt-1 text-xs text-ink-500">
              Tom de voz e regras de comportamento — inclusive quando transferir pra um atendente humano.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={aiLoading}
              className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
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
