'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import ActivityPanel from './ActivityPanel'
import InboxTab from './InboxTab'
import CommentsTab from './CommentsTab'
import PublishTab from './PublishTab'
import InsightsTab from './InsightsTab'
import CalendarTab from './CalendarTab'
import { IG_TABS, type IgTab } from '@/lib/instagramTabs'

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
  // A aba agora é controlada pelo menu lateral (que navega via ?tab=...) — a
  // página só lê o valor atual da URL, sem estado próprio nem abas aqui dentro.
  const tabParam = searchParams.get('tab')
  const tab: IgTab = (IG_TABS.some((t) => t.key === tabParam) ? tabParam : 'visao-geral') as IgTab
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

  // Feedback do callback OAuth (/api/instagram/callback e /api/canva/callback)
  useEffect(() => {
    const erro = searchParams.get('erro')
    const conectado = searchParams.get('conectado')
    const canvaErro = searchParams.get('canvaErro')
    const canvaConectado = searchParams.get('canvaConectado')

    if (erro) {
      toast.error(erro)
    } else if (conectado) {
      toast.success('Instagram conectado com sucesso!')
    } else if (canvaErro) {
      toast.error(canvaErro)
    } else if (canvaConectado) {
      toast.success('Canva conectado com sucesso!')
    } else {
      return
    }
    // Limpa só os parâmetros de feedback do OAuth — preserva a aba atual.
    router.replace(tabParam ? `/dashboard/instagram?tab=${tabParam}` : '/dashboard/instagram')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-bold text-ink-900">Instagram</h1>
        <p className="text-sm text-ink-500">Mensagens diretas, comentários, publicações e métricas da sua conta profissional — tudo em um só lugar.</p>
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
      {tab === 'calendario' && <CalendarTab connected={connected} />}
      {tab === 'metricas' && <InsightsTab connected={connected} />}
    </div>
  )
}
