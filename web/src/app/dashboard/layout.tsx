import { auth, getSessionWithPlatformAdmin } from '@/lib/auth'
import { obterConta } from '@/lib/firestore'
import { SERVICOS_PADRAO } from '@/lib/servicos'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, isRealPlatformAdmin, viewingAsClient } = await getSessionWithPlatformAdmin()

  // Admin de plataforma enxerga o menu completo, a não ser que tenha ligado
  // "Ver como cliente" (mesma lógica dos gates de rota por módulo).
  let servicosContratados = SERVICOS_PADRAO
  if (!isPlatformAdmin || viewingAsClient) {
    const session = await auth()
    if (session?.user?.contaId) {
      const conta = await obterConta(session.user.contaId)
      servicosContratados = conta?.servicosContratados ?? SERVICOS_PADRAO
    }
  }

  return (
    <DashboardShell
      isPlatformAdmin={isPlatformAdmin}
      isRealPlatformAdmin={isRealPlatformAdmin}
      viewingAsClient={viewingAsClient}
      servicosContratados={servicosContratados}
    >
      {children}
    </DashboardShell>
  )
}
