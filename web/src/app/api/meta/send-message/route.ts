import { cookies } from 'next/headers'
import { sendTextMessage, getMetaCredentials } from '@/lib/meta'

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

  try {
    // Busca as credenciais do Firebase
    const credentials = await getMetaCredentials()
    
    // Sanitiza o número: apenas dígitos
    const to = body.to.replace(/\D/g, '')
    if (to.length < 10) {
      return Response.json({ error: 'Número de telefone inválido' }, { status: 400 })
    }

    const result = await sendTextMessage(credentials.phoneNumberId, credentials.businessToken, to, body.message)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
