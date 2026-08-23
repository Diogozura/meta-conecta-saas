import type { FunilEtapa } from '@/types/database'

// Funil padrão de vendas — cobre o caso comum de telemarketing/internet
// (lead entra, alguém liga/manda mensagem, negocia, fecha ou perde). Uma
// conta pode reconfigurar isso em /dashboard/crm; sem nada configurado,
// usa isso (mesmo padrão "ausente = default" do resto da conta).
export const ETAPAS_PADRAO: FunilEtapa[] = [
  { id: 'novo', nome: 'Novo lead', cor: '#3b82f6' },
  { id: 'contato', nome: 'Em contato', cor: '#f59e0b' },
  { id: 'negociacao', nome: 'Em negociação', cor: '#8b5cf6' },
  { id: 'fechado', nome: 'Fechado', cor: '#22c55e' },
  { id: 'perdido', nome: 'Perdido', cor: '#ef4444' },
]

export function obterEtapasFunil(funilEtapas: FunilEtapa[] | null | undefined): FunilEtapa[] {
  return funilEtapas && funilEtapas.length > 0 ? funilEtapas : ETAPAS_PADRAO
}

/**
 * A que etapa uma conversa pertence pra fins de exibição no Kanban — uma
 * conversa sem etapa (nova) ou apontando pra uma etapa que foi excluída
 * depois cai na PRIMEIRA coluna, nunca fica "invisível" no board.
 */
export function etapaAtualId(etapaFunilId: string | null | undefined, etapas: FunilEtapa[]): string {
  if (etapaFunilId && etapas.some((e) => e.id === etapaFunilId)) return etapaFunilId
  return etapas[0]?.id ?? ''
}

const TAMANHO_MAX_LISTA = 20

export function validarFunilEtapas(body: unknown): FunilEtapa[] | null {
  if (!Array.isArray(body) || body.length === 0 || body.length > TAMANHO_MAX_LISTA) return null
  const ids = new Set<string>()
  for (const e of body) {
    if (!e || typeof e !== 'object') return null
    const { id, nome, cor } = e as Record<string, unknown>
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) return null
    if (typeof nome !== 'string' || !nome.trim()) return null
    if (typeof cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(cor)) return null
    ids.add(id)
  }
  return body as FunilEtapa[]
}
