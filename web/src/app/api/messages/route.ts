import { getMessagesSince } from '@/lib/messageStore'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const since = parseInt(searchParams.get('since') ?? '0')

  const messages = getMessagesSince(since)

  return Response.json({ messages, serverTime: Date.now() })
}
