import type { PlanoTipo, ServicosContratados } from '@/types/database'

export const SERVICOS_PADRAO: ServicosContratados = { whatsapp: true, agenda: true, instagram: true, crm: true, tickets: true }

export const PLANOS: { valor: PlanoTipo; label: string }[] = [
  { valor: 'base', label: 'Base' },
  { valor: 'medio', label: 'Médio' },
  { valor: 'premium', label: 'Premium' },
]

/**
 * Módulos habilitados por plano — só demonstrativo (não conta/trava quantos
 * números de WhatsApp ou contas de Instagram estão conectados, só liga ou
 * desliga o módulo inteiro). Base não inclui Instagram; Médio e Premium
 * incluem os dois. Agenda/CRM/Tickets não dependem do plano, continuam só
 * no controle manual por módulo em /dashboard/servicos.
 */
export const PLANO_SERVICOS: Record<PlanoTipo, Pick<ServicosContratados, 'whatsapp' | 'instagram'>> = {
  base: { whatsapp: true, instagram: false },
  medio: { whatsapp: true, instagram: true },
  premium: { whatsapp: true, instagram: true },
}

/**
 * Se uma conta tem acesso a um módulo. `undefined`/`null` (conta legada, ou
 * nunca configurada por um admin de plataforma em /dashboard/servicos) conta
 * como acesso total — só passa a restringir depois que um admin define
 * `servicosContratados` explicitamente pra essa conta. Isso evita que ligar
 * essa feature bloqueie, da noite pro dia, contas que já usam o sistema.
 */
export function temServico(servicosContratados: Partial<ServicosContratados> | null | undefined, servico: keyof ServicosContratados): boolean {
  if (!servicosContratados) return true
  return servicosContratados[servico] ?? true
}
