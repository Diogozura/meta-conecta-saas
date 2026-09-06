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

// Mesmo `id` em toda chamada: se os 3 pollers baterem nisso ao mesmo tempo
// (ou a cada 20s enquanto durar), o sonner atualiza o toast existente em
// vez de empilhar um atrás do outro.
function avisarLimiteFirebase() {
  toast.error('Passou do limite diário de requisição do Firebase.', {
    id: 'firestore-quota-exceeded',
    description: 'As atualizações em tempo real do painel ficam pausadas até a cota renovar. Isso não é um problema de login.',
    duration: 15000,
    position: 'top-right',
  })
}

/** Só os pollers passam por aqui — se a resposta não é 2xx por outro motivo (sessão realmente expirada, etc.), continua em silêncio como antes. */
async function tratarRespostaComErro(res: Response) {
  if (res.status !== 503) return
  try {
    const body = await res.json()
    if (body?.code === 'firestore_quota_exceeded') avisarLimiteFirebase()
  } catch {}
}

/**
 * "Push-lite": notificação de desktop via Notification API do navegador —
 * não é Web Push de verdade (não funciona com o navegador fechado, exigiria
 * Service Worker + VAPID), mas funciona com essa aba em segundo plano numa
 * outra janela/app, que é onde o toast (só dentro da própria aba) não ajuda.
 * Só dispara quando a aba não está em foco — se está, o toast já é visível,
 * duplicar viraria ruído.
 */
function notificarDesktop(titulo: string, opcoes?: NotificationOptions & { aoClicar?: () => void }) {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return
  if (Notification.permission !== 'granted' || document.hasFocus()) return
  try {
    const notificacao = new Notification(titulo, opcoes)
    if (opcoes?.aoClicar) {
      notificacao.onclick = () => {
        window.focus()
        opcoes.aoClicar!()
        notificacao.close()
      }
    }
  } catch {
    // Notification pode falhar silenciosamente em alguns navegadores/contextos (ex: iframe) — não é crítico.
  }
}

export function RealtimeListeners() {
  const pathname = usePathname()
  const router = useRouter()

  // Pede permissão de notificação de desktop uma vez — se o usuário já
  // decidiu antes (concedeu ou negou), o navegador nem mostra o prompt de novo.
  useEffect(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return
    Notification.requestPermission().catch(() => {})
  }, [])

  useEffect(() => {
    if (pathname === '/dashboard/conversas') return

    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/messages?since=${since}`)
        if (!res.ok) { await tratarRespostaComErro(res); return }
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
        if (!res.ok) { await tratarRespostaComErro(res); return }
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

  // Notifica em tempo real de comentário/menção novo no Instagram — complementa o resumo semanal
  // por e-mail (que só avisa 1x por semana, ver api/cron/sla-alertas).
  useEffect(() => {
    if (pathname.startsWith('/dashboard/instagram')) return

    let since = Date.now()

    const poll = async () => {
      try {
        const res = await fetch(`/api/instagram/activity/recentes?since=${since}`)
        if (!res.ok) { await tratarRespostaComErro(res); return }
        const { comentarios, mencoes, serverTime } = await res.json()
        since = serverTime
        for (const c of comentarios ?? []) {
          toast.message(`Novo comentário de @${c.from}`, {
            description: c.text,
            duration: 6000,
            position: 'top-right',
            action: { label: 'Abrir', onClick: () => router.push('/dashboard/instagram?tab=comentarios') },
          })
        }
        for (const m of mencoes ?? []) {
          toast.message(`Nova menção${m.username ? ` de @${m.username}` : ''}`, {
            description: m.text ?? (m.tipo === 'legenda' ? 'Marcou vocês na legenda de um post' : 'Marcou vocês num comentário'),
            duration: 6000,
            position: 'top-right',
            action: { label: 'Abrir', onClick: () => router.push('/dashboard/instagram?tab=comentarios') },
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
        if (!res.ok) { await tratarRespostaComErro(res); return }
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
          notificarDesktop('Atendimento humano necessário', {
            body: `${evt.numero} — ${evt.motivo}`,
            tag: `handoff-${evt.numero}`, // mesma tag substitui a notificação anterior desse número em vez de empilhar
            aoClicar: () => router.push(`/dashboard/conversas?from=${evt.numero}`),
          })
        }
      } catch {}
    }

    return startVisibilityAwarePolling(poll, POLL_INTERVAL_MS)
  }, [router])

  return null
}
