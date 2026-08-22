import { redirect } from 'next/navigation'
import { auth, getSessionWithPlatformAdmin } from '@/lib/auth'
import { obterConta } from '@/lib/firestore'
import { temServico } from '@/lib/servicos'

// Bloqueia /dashboard/onboarding (conectar WABA) pra contas sem o serviço
// "whatsapp" contratado — mesmo padrão dos outros módulos. Admin de
// plataforma vê tudo, a não ser que tenha ligado "Ver como cliente".
export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, viewingAsClient } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin || viewingAsClient) {
    const session = await auth()
    if (session?.user?.contaId) {
      const conta = await obterConta(session.user.contaId)
      if (!temServico(conta?.servicosContratados, 'whatsapp')) {
        redirect('/dashboard')
      }
    }
  }

  return <>{children}</>
}
