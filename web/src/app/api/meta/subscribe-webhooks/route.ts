import { cookies } from 'next/headers'
import { subscribeToWebhooks } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: { wabaId?: string; accessToken?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.wabaId || !body.accessToken) {
    return Response.json({ error: 'Campos "wabaId" e "accessToken" são obrigatórios' }, { status: 400 })
  }

  try {
    const result = await subscribeToWebhooks(body.wabaId, body.accessToken)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
