import { getSessionWithPlatformAdmin } from '@/lib/auth'
import DashboardShell from './DashboardShell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin } = await getSessionWithPlatformAdmin()

  return <DashboardShell isPlatformAdmin={isPlatformAdmin}>{children}</DashboardShell>
}
