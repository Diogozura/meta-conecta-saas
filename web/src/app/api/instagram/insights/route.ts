import { NextResponse } from 'next/server'
import { getInstagramCredentials, getAccountInsights, InstagramApiError } from '@/lib/instagram'

const METRICS = ['reach', 'profile_views', 'accounts_engaged']

// GET /api/instagram/insights - Métricas da conta (alcance, visitas ao perfil, contas alcançadas)
export async function GET() {
  try {
    const credentials = await getInstagramCredentials()
    const insights = await getAccountInsights(credentials.accessToken, credentials.igUserId, METRICS, 'day')
    return NextResponse.json({ insights })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
