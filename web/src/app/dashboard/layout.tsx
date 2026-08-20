import { getSessionWithPlatformAdmin } from '@/lib/auth'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, isRealPlatformAdmin, viewingAsClient } = await getSessionWithPlatformAdmin()

  return (
    <DashboardShell isPlatformAdmin={isPlatformAdmin} isRealPlatformAdmin={isRealPlatformAdmin} viewingAsClient={viewingAsClient}>
      {children}
    </DashboardShell>
  )
}
