import { cookies } from 'next/headers'
import { exchangeCodeForToken } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: { code?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.code) {
    return Response.json({ error: 'Campo "code" obrigatório' }, { status: 400 })
  }

  try {
    const result = await exchangeCodeForToken(body.code)
    return Response.json({ access_token: result.access_token })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
