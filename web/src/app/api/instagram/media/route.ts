import { NextResponse } from 'next/server'
import { getInstagramCredentials, listRecentMedia, InstagramApiError } from '@/lib/instagram'

// GET /api/instagram/media - Lista as publicações recentes (posts/reels/vídeos)
export async function GET() {
  try {
    const credentials = await getInstagramCredentials()
    const media = await listRecentMedia(credentials.accessToken, credentials.igUserId)
    return NextResponse.json({ media })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
