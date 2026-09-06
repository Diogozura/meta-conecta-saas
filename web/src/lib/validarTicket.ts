import type { Ticket, TicketPrioridade, TicketStatus } from '@/types/database'

const STATUS_VALIDOS = new Set<TicketStatus>(['aberto', 'em_andamento', 'resolvido', 'fechado'])
const PRIORIDADES_VALIDAS = new Set<TicketPrioridade>(['baixa', 'normal', 'alta', 'urgente'])
const ORIGENS_VALIDAS = new Set<Ticket['origem']>(['whatsapp', 'instagram'])

export function validarNovoTicket(
  body: unknown
): { numero: string; assunto: string; descricao?: string; prioridade: TicketPrioridade; origem?: Ticket['origem'] } | null {
  if (!body || typeof body !== 'object') return null
  const { numero, assunto, descricao, prioridade, origem } = body as Record<string, unknown>
  if (typeof numero !== 'string' || !numero.trim()) return null
  if (typeof assunto !== 'string' || !assunto.trim()) return null
  if (descricao !== undefined && typeof descricao !== 'string') return null
  if (prioridade !== undefined && (typeof prioridade !== 'string' || !PRIORIDADES_VALIDAS.has(prioridade as TicketPrioridade))) return null
  if (origem !== undefined && (typeof origem !== 'string' || !ORIGENS_VALIDAS.has(origem as Ticket['origem']))) return null
  return {
    numero: numero.trim(),
    assunto: assunto.trim(),
    ...(descricao?.trim() ? { descricao: descricao.trim() } : {}),
    prioridade: (prioridade as TicketPrioridade | undefined) ?? 'normal',
    ...(origem ? { origem: origem as Ticket['origem'] } : {}),
  }
}

export function validarAtualizacaoTicket(
  body: unknown
): Partial<{ status: TicketStatus; prioridade: TicketPrioridade; descricao: string; atendenteId: string | null; atendenteNome: string | null }> | null {
  if (!body || typeof body !== 'object') return null
  const { status, prioridade, descricao, atendenteId, atendenteNome } = body as Record<string, unknown>
  const patch: Record<string, unknown> = {}

  if (status !== undefined) {
    if (typeof status !== 'string' || !STATUS_VALIDOS.has(status as TicketStatus)) return null
    patch.status = status
  }
  if (prioridade !== undefined) {
    if (typeof prioridade !== 'string' || !PRIORIDADES_VALIDAS.has(prioridade as TicketPrioridade)) return null
    patch.prioridade = prioridade
  }
  if (descricao !== undefined) {
    if (typeof descricao !== 'string') return null
    patch.descricao = descricao
  }
  if (atendenteId !== undefined) {
    if (atendenteId !== null && typeof atendenteId !== 'string') return null
    patch.atendenteId = atendenteId
    patch.atendenteNome = typeof atendenteNome === 'string' ? atendenteNome : null
  }

  return Object.keys(patch).length > 0 ? patch : null
}
