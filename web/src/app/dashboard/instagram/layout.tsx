import { redirect } from 'next/navigation'
import { auth, getSessionWithPlatformAdmin } from '@/lib/auth'
import { obterConta } from '@/lib/firestore'
import { temServico } from '@/lib/servicos'

// Bloqueia /dashboard/instagram pra contas sem o serviço "instagram"
// contratado — além de escondido no menu (DashboardShell), pra quem tentar
// acessar a URL direto. Admin de plataforma vê tudo, a não ser que tenha
// ligado "Ver como cliente" (mesmo padrão do gate de conexão do WhatsApp em
// DashboardShell).
export default async function InstagramLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, viewingAsClient } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin || viewingAsClient) {
    const session = await auth()
    if (session?.user?.contaId) {
      const conta = await obterConta(session.user.contaId)
      if (!temServico(conta?.servicosContratados, 'instagram')) {
        redirect('/dashboard')
      }
    }
  }

  return <>{children}</>
}
