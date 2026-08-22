import { NextRequest, NextResponse } from 'next/server'
import { getInstagramCredentials, listConversationMessages, InstagramApiError } from '@/lib/instagram'

// GET /api/instagram/conversations/[id]/messages - Histórico de mensagens de uma conversa
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const credentials = await getInstagramCredentials()
    const messages = await listConversationMessages(credentials.accessToken, id)
    return NextResponse.json({ messages })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
