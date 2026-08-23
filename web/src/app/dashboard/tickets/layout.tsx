import { redirect } from 'next/navigation'
import { auth, getSessionWithPlatformAdmin } from '@/lib/auth'
import { obterConta } from '@/lib/firestore'
import { temServico } from '@/lib/servicos'

// Bloqueia /dashboard/tickets pra contas sem o serviço "tickets" contratado
// — mesmo padrão dos outros módulos (ver dashboard/agenda/layout.tsx).
export default async function TicketsLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, viewingAsClient } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin || viewingAsClient) {
    const session = await auth()
    if (session?.user?.contaId) {
      const conta = await obterConta(session.user.contaId)
      if (!temServico(conta?.servicosContratados, 'tickets')) {
        redirect('/dashboard')
      }
    }
  }

  return <>{children}</>
}
