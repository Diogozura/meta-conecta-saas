import { Inbox, MessageCircle, Send, BarChart3, LayoutGrid, Calendar, type LucideIcon } from 'lucide-react'

// Compartilhado entre a página do Instagram (que renderiza a aba escolhida) e o
// menu lateral (que agora é quem decide pra qual aba navegar) — só existe um
// lugar pra manter essa lista.
export type IgTab = 'visao-geral' | 'inbox' | 'comentarios' | 'publicar' | 'calendario' | 'metricas'

export const IG_TABS: { key: IgTab; label: string; icon: LucideIcon }[] = [
  { key: 'visao-geral', label: 'Visão geral', icon: LayoutGrid },
  { key: 'inbox', label: 'Caixa de entrada', icon: Inbox },
  { key: 'comentarios', label: 'Comentários', icon: MessageCircle },
  { key: 'publicar', label: 'Publicar', icon: Send },
  { key: 'calendario', label: 'Calendário', icon: Calendar },
  { key: 'metricas', label: 'Métricas', icon: BarChart3 },
]
