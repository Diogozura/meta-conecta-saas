import { redirect } from 'next/navigation'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import EmpresasPageClient from './EmpresasPageClient'

// "Clientes" (Empresas) é uma tela de admin de plataforma — vê/gerencia
// TODAS as empresas. Bloqueado aqui além de escondido no menu (DashboardShell),
// pra quem tentar acessar a URL direto sem ser admin de plataforma.
export default async function EmpresasPage() {
  const { session, isPlatformAdmin } = await getSessionWithPlatformAdmin()

  if (!session) {
    redirect('/login')
  }
  if (!isPlatformAdmin) {
    redirect('/dashboard')
  }

  return <EmpresasPageClient />
}
