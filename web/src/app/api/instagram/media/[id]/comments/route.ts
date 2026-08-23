import { NextRequest, NextResponse } from 'next/server'
import { getInstagramCredentials, listMediaComments, InstagramApiError } from '@/lib/instagram'

// GET /api/instagram/media/[id]/comments - Comentários de uma publicação
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const credentials = await getInstagramCredentials()
    const comments = await listMediaComments(credentials.accessToken, id, { igUserId: credentials.igUserId, username: credentials.username })
    return NextResponse.json({ comments })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
