'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

// Notificações em segundo plano (toasts) — não é o chat ao vivo, então não
// precisa de cadência agressiva. Cada poll bate no Firestore via auth() +
// a própria query; com 3 pollers rodando o dashboard inteiro em todo tab
// aberta, um intervalo curto estoura a cota gratuita do Firestore rápido
// (foi o que causou a queda em produção). Pausa também quando a aba está
// em segundo plano, já que o usuário não está olhando mesmo.
const POLL_INTERVAL_MS = 20000

function startVisibilityAwarePolling(poll: () => Promise<void>, intervalMs: number) {
  const id = setInterval(() => {
    if (document.hidden) return
    void poll()
  }, intervalMs)
  return () => clearInterval(id)
}

export function RealtimeListeners() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname === '/dashboard/conversas') return

    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) return
        const { messages, serverTime } = await res.json()
        since = serverTime
        for (const msg of messages) {
          toast.message(`Nova mensagem de ${msg.from}`, {
            description: msg.text,
            duration: 5000,
            position: 'top-right',
            action: {
              label: 'Abrir',
              onClick: () => router.push(`/dashboard/conversas?from=${msg.from}`),
            },
          })
        }
      } catch {}
    }

    return startVisibilityAwarePolling(poll, POLL_INTERVAL_MS)
  }, [pathname, router])

  // Notifica a empresa sobre novos agendamentos (criados manualmente por
  // outro usuário, ou no futuro pelo agente de IA no WhatsApp).
  useEffect(() => {
    if (pathname === '/dashboard/agenda') return

    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/agenda/agendamentos/recentes?since=${since}`)
        if (!res.ok) return
        const { eventos, serverTime } = await res.json()
        since = serverTime
        for (const evt of eventos) {
          const hora = new Date(evt.inicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          toast.message('Novo agendamento', {
            description: `${evt.clienteNome} com ${evt.profissionalNome} às ${hora}`,
            duration: 5000,
            position: 'top-right',
            action: {
              label: 'Abrir',
              onClick: () => router.push('/dashboard/agenda'),
            },
          })
        }
      } catch {}
    }

    return startVisibilityAwarePolling(poll, POLL_INTERVAL_MS)
  }, [pathname, router])

  // Notifica a empresa quando a IA transfere uma conversa pra atendimento humano.
  useEffect(() => {
    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/handoff/recentes?since=${since}`)
        if (!res.ok) return
        const { eventos, serverTime } = await res.json()
        since = serverTime
        for (const evt of eventos) {
          toast.message('Atendimento humano necessário', {
            description: `${evt.numero} — ${evt.motivo}`,
            duration: 8000,
            position: 'top-right',
            action: {
              label: 'Abrir',
              onClick: () => router.push(`/dashboard/conversas?from=${evt.numero}`),
            },
          })
        }
      } catch {}
    }

    return startVisibilityAwarePolling(poll, POLL_INTERVAL_MS)
  }, [router])

  return null
}
