import { NextRequest, NextResponse } from 'next/server'
import { getInstagramCredentials, getAccountInsights, getAccountTotals, getFollowerGrowth, getContactButtonBreakdown, InstagramApiError } from '@/lib/instagram'

// profile_views e website_clicks foram descontinuadas pela Meta — as métricas atuais de conta
// exigem metric_type=total_value (ver lib/instagram.ts).
const CORE_METRICS = ['reach', 'accounts_engaged', 'total_interactions', 'likes', 'comments', 'shares', 'saves']

const WINDOWS = ['day', 'week', 'days_28'] as const
type Window = (typeof WINDOWS)[number]

// Janela pedida pelo usuário (24h/7 dias/mês). NÃO confundir com o parâmetro "period" da Graph API:
// pra metric_type=total_value a API só aceita period=day — a janela de 7/28 dias é feita com since/until,
// não com period=week/days_28 (isso não existe pra total_value e a API ignora silenciosamente, o que
// fazia as 3 abas mostrarem sempre o mesmo número).
const WINDOW_DAYS: Record<Window, number> = { day: 1, week: 7, days_28: 28 }

// GET /api/instagram/insights?period=day|week|days_28 - Métricas da conta
export async function GET(req: NextRequest) {
  try {
    const windowParam = req.nextUrl.searchParams.get('period') ?? 'day'
    const window: Window = WINDOWS.includes(windowParam as Window) ? (windowParam as Window) : 'day'

    const credentials = await getInstagramCredentials()
    const { accessToken, igUserId } = credentials

    const nowUnix = Math.floor(Date.now() / 1000)
    const sinceUnix = nowUnix - WINDOW_DAYS[window] * 86400

    const [insightsResult, contactResult, totalsResult, followerGrowthResult] = await Promise.allSettled([
      getAccountInsights(accessToken, igUserId, CORE_METRICS, { metricType: 'total_value', since: sinceUnix, until: nowUnix }),
      getContactButtonBreakdown(accessToken, igUserId, sinceUnix, nowUnix),
      getAccountTotals(accessToken, igUserId),
      getFollowerGrowth(accessToken, igUserId, sinceUnix, nowUnix),
    ])

    if (insightsResult.status === 'rejected') throw insightsResult.reason

    if (contactResult.status === 'rejected') console.error('[Instagram] Falha ao buscar toques de contato:', contactResult.reason)
    if (totalsResult.status === 'rejected') console.error('[Instagram] Falha ao buscar totais da conta:', totalsResult.reason)
    if (followerGrowthResult.status === 'rejected') console.error('[Instagram] Falha ao buscar crescimento de seguidores:', followerGrowthResult.reason)

    return NextResponse.json({
      period: window,
      insights: insightsResult.value,
      contactBreakdown: contactResult.status === 'fulfilled' ? contactResult.value : [],
      totals: totalsResult.status === 'fulfilled' ? totalsResult.value : null,
      followerGrowth: followerGrowthResult.status === 'fulfilled' ? followerGrowthResult.value : null,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof InstagramApiError ? err.code : undefined
    return NextResponse.json({ error: message, code }, { status: 502 })
  }
}
