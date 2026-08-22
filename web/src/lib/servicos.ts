import type { ServicosContratados } from '@/types/database'

export const SERVICOS_PADRAO: ServicosContratados = { whatsapp: true, agenda: true, instagram: true }

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
