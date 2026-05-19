'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { createPusherClient } from '@/lib/pusher'

export function RealtimeListeners() {
  useEffect(() => {
    // Inscreve no canal que criamos no backend
    const pusherClient = createPusherClient()
    const channel = pusherClient.subscribe('whatsapp-chat')

    // Escuta o evento 'new-message'
    channel.bind('new-message', (data: any) => {
      // Exibe um toast bonitinho
      toast.success(`Nova mensagem de ${data.from}`, {
        description: data.text || 'Mensagem recebida',
        duration: 5000,
        position: 'top-right',
      })
    })

    return () => {
      channel.unbind_all()
      channel.unsubscribe()
      pusherClient.disconnect()
    }
  }, [])

  return null
}