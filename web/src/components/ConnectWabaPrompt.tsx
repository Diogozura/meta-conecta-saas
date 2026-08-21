'use client'

import { useRouter } from 'next/navigation'
import { Smartphone } from 'lucide-react'
import { Modal } from '@/components/Modal'

/**
 * Lembrete pra conectar o WhatsApp — controlado de fora (DashboardShell
 * decide quando checar e quando abrir, antes de liberar o resto da tela).
 */
export function ConnectWabaPrompt({ open, onDismiss }: { open: boolean; onDismiss: () => void }) {
  const router = useRouter()

  function connectNow() {
    onDismiss()
    router.push('/dashboard/onboarding')
  }

  return (
    <Modal open={open} onClose={onDismiss} title="Conectar WhatsApp">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        <div className="w-14 h-14 rounded-full bg-brand-100 flex items-center justify-center">
          <Smartphone className="w-7 h-7 text-brand-600" />
        </div>
        <div>
          <p className="text-base font-semibold text-ink-900">Conecte seu WhatsApp agora</p>
          <p className="text-sm text-ink-500 mt-1.5">
            Essa conta ainda não tem um número do WhatsApp conectado — sem isso, o painel e o agente de IA não enviam nem recebem mensagens.
          </p>
        </div>
        <div className="flex gap-2 w-full mt-2">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 px-4 py-2.5 border border-ink-300 rounded-lg text-sm font-medium text-ink-700 hover:bg-ink-50 transition-colors"
          >
            Agora não
          </button>
          <button
            type="button"
            onClick={connectNow}
            className="flex-1 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-semibold transition-colors"
          >
            Conectar agora
          </button>
        </div>
      </div>
    </Modal>
  )
}
