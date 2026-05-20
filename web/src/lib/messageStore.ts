// In-memory store for incoming WhatsApp messages.
// Works reliably on a single warm Vercel instance (hobby plan, single user).

export type IncomingMessage = {
  id: string
  from: string
  text: string
  timestamp: number  // unix seconds (from Meta)
  receivedAt: number // Date.now() — used for polling since=<ms>
}

const store: IncomingMessage[] = []

export function addMessage(msg: Omit<IncomingMessage, 'receivedAt'>) {
  // Avoid duplicates (webhook can fire twice)
  if (store.some((m) => m.id === msg.id)) return
  store.push({ ...msg, receivedAt: Date.now() })
  // Keep only the last 500 messages
  if (store.length > 500) store.splice(0, store.length - 500)
}

export function getMessagesSince(since: number): IncomingMessage[] {
  return store.filter((m) => m.receivedAt > since)
}
