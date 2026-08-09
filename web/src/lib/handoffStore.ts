// In-memory store para notificar a empresa quando a IA transfere uma
// conversa pra atendimento humano. Mesmo padrão de agendamentoStore.ts —
// escopado por contaId, cada empresa só vê os próprios avisos.

export type HandoffEvent = {
  id: string
  contaId: string
  numero: string
  motivo: string
  receivedAt: number
}

const store: HandoffEvent[] = []

export function addHandoffEvent(evt: Omit<HandoffEvent, 'id' | 'receivedAt'>) {
  const id = `${evt.contaId}:${evt.numero}:${Date.now()}`
  store.push({ ...evt, id, receivedAt: Date.now() })
  if (store.length > 500) store.splice(0, store.length - 500)
}

export function getHandoffEventsSince(contaId: string, since: number): HandoffEvent[] {
  return store.filter((e) => e.contaId === contaId && e.receivedAt > since)
}
