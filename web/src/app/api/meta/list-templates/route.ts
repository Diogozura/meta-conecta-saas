import { cookies } from 'next/headers'
import { listTemplates } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function GET() {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const wabaId = process.env.META_WABA_ID
  const businessToken = process.env.META_BUSINESS_TOKEN

  if (!wabaId || !businessToken) {
    return Response.json(
      { error: 'META_WABA_ID e META_BUSINESS_TOKEN não configurados no .env.local' },
      { status: 503 },
    )
  }

  try {
    const templates = await listTemplates(wabaId, businessToken)
    return Response.json({ templates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
