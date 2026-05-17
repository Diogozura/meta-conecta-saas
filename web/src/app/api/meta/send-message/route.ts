import { cookies } from 'next/headers'
import { sendTextMessage } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: { to?: string; message?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  if (!body.to || !body.message) {
    return Response.json({ error: 'Campos "to" e "message" são obrigatórios' }, { status: 400 })
  }

  const phoneNumberId = process.env.META_PHONE_NUMBER_ID
  const businessToken = process.env.META_BUSINESS_TOKEN

  if (!phoneNumberId || !businessToken) {
    return Response.json(
      { error: 'META_PHONE_NUMBER_ID e META_BUSINESS_TOKEN não configurados no .env' },
      { status: 503 },
    )
  }

  // Sanitiza o número: apenas dígitos
  const to = body.to.replace(/\D/g, '')
  if (to.length < 10) {
    return Response.json({ error: 'Número de telefone inválido' }, { status: 400 })
  }

  try {
    const result = await sendTextMessage(phoneNumberId, businessToken, to, body.message)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
