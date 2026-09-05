import { NextResponse } from 'next/server'
import { getInstagramCredentials, listConversations, InstagramApiError } from '@/lib/instagram'

// GET /api/instagram/conversations - Lista as conversas de DM da conta conectada
export async function GET() {
  try {
    const credentials = await getInstagramCredentials()
    const conversations = await listConversations(credentials.accessToken, credentials.igUserId)
    return NextResponse.json({ conversations })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
