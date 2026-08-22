'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Inbox, MessageCircle, Send, BarChart3, LayoutGrid } from 'lucide-react'
import ActivityPanel from './ActivityPanel'
import InboxTab from './InboxTab'
import CommentsTab from './CommentsTab'
import PublishTab from './PublishTab'
import InsightsTab from './InsightsTab'

type IgTab = 'visao-geral' | 'inbox' | 'comentarios' | 'publicar' | 'metricas'

const igTabs: { key: IgTab; label: string; icon: typeof Inbox }[] = [
  { key: 'visao-geral', label: 'Visão geral', icon: LayoutGrid },
  { key: 'inbox', label: 'Caixa de entrada', icon: Inbox },
  { key: 'comentarios', label: 'Comentários', icon: MessageCircle },
  { key: 'publicar', label: 'Publicar', icon: Send },
  { key: 'metricas', label: 'Métricas', icon: BarChart3 },
]

export default function InstagramPage() {
  return (
    <Suspense>
      <InstagramPageInner />
    </Suspense>
  )
}

function InstagramPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab] = useState<IgTab>('visao-geral')
  const [connected, setConnected] = useState(false)
  const [checkingConnection, setCheckingConnection] = useState(true)

  // Precisa saber se a conta está conectada assim que a página carrega — usado
  // por todas as abas (Inbox, Comentários...) pra decidir se buscam dados ou
  // mostram o aviso de "conecte primeiro".
  useEffect(() => {
    fetch('/api/instagram/credentials')
      .then((res) => res.json())
      .then((data) => setConnected(!!data.credentials?.username))
      .catch(() => {})
      .finally(() => setCheckingConnection(false))
  }, [])

  // Feedback do callback OAuth (/api/instagram/callback)
  useEffect(() => {
    const erro = searchParams.get('erro')
    const conectado = searchParams.get('conectado')
    if (erro) {
      toast.error(erro)
    } else if (conectado) {
      toast.success('Instagram conectado com sucesso!')
    } else {
      return
    }
    router.replace('/dashboard/instagram')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-lg font-bold text-ink-900">Instagram</h1>
        <p className="text-sm text-ink-500">Mensagens diretas, comentários, publicações e métricas da sua conta profissional — tudo em um só lugar.</p>
      </div>

      <div className="flex items-center gap-1 border-b border-ink-200 mb-6 mt-4 overflow-x-auto overflow-y-hidden scrollbar-thin">
        {igTabs.map((t) => {
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

      {tab === 'visao-geral' && (
        checkingConnection ? null : connected ? (
          <ActivityPanel connected={connected} />
        ) : (
          <div className="bg-white rounded-xl border border-ink-200 p-8 text-center text-sm text-ink-500">
            Instagram não conectado. Conecte em{' '}
            <Link href="/dashboard/configuracoes" className="text-brand-700 font-medium hover:underline">
              Configurações → aba Instagram
            </Link>
            .
          </div>
        )
      )}
      {tab === 'inbox' && <InboxTab connected={connected} />}
      {tab === 'comentarios' && <CommentsTab connected={connected} />}
      {tab === 'publicar' && <PublishTab connected={connected} />}
      {tab === 'metricas' && <InsightsTab connected={connected} />}
    </div>
  )
}
