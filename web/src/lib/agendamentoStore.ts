// In-memory store para notificar a empresa sobre novos agendamentos.
// Mesmo padrão de messageStore.ts (funciona bem numa instância única, warm).
// Diferente de messageStore.ts, é escopado por contaId — cada empresa só
// pode ver notificações de agendamentos da própria conta.

export type AgendamentoEvent = {
  id: string
  contaId: string
  clienteNome: string
  profissionalNome: string
  inicio: number  // unix ms do início do agendamento
  receivedAt: number
}

const store: AgendamentoEvent[] = []

export function addAgendamentoEvent(evt: Omit<AgendamentoEvent, 'receivedAt'>) {
  if (store.some((e) => e.id === evt.id)) return
  store.push({ ...evt, receivedAt: Date.now() })
  if (store.length > 500) store.splice(0, store.length - 500)
}

export function getAgendamentoEventsSince(contaId: string, since: number): AgendamentoEvent[] {
  return store.filter((e) => e.contaId === contaId && e.receivedAt > since)
}
