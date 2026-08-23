import { NextResponse } from 'next/server'
import { getInstagramCredentials, getAccountInsights, InstagramApiError } from '@/lib/instagram'

// profile_views e website_clicks foram descontinuadas pela Meta — as métricas atuais de conta
// exigem metric_type=total_value (ver lib/instagram.ts).
const METRICS = ['reach', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves']

// GET /api/instagram/insights - Métricas da conta (alcance, engajamento, curtidas, comentários etc.)
export async function GET() {
  try {
    const credentials = await getInstagramCredentials()
    const insights = await getAccountInsights(credentials.accessToken, credentials.igUserId, METRICS, 'day', 'total_value')
    return NextResponse.json({ insights })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
