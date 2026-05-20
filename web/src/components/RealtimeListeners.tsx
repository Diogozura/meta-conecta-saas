'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'

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

    const id = setInterval(poll, 3000)
    return () => clearInterval(id)
  }, [pathname, router])

  return null
}
