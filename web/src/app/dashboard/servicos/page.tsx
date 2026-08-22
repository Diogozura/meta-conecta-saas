import { redirect } from 'next/navigation'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import ServicosPageClient from './ServicosPageClient'

// "Serviços por conta" é uma tela de admin de plataforma — define quais
// módulos (WhatsApp/Agenda/Instagram) cada conta do Firestore pode usar.
// Bloqueado aqui além de escondido no menu (DashboardShell), pra quem tentar
// acessar a URL direto sem ser admin de plataforma — mesmo padrão de /dashboard/clientes.
export default async function ServicosPage() {
  const { session, isPlatformAdmin } = await getSessionWithPlatformAdmin()

  if (!session) {
    redirect('/login')
  }
  if (!isPlatformAdmin) {
    redirect('/dashboard')
  }

  return <ServicosPageClient />
}
