import { cookies } from 'next/headers'
import { listTemplates, getMetaCredentials } from '@/lib/meta'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function GET() {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Busca as credenciais do Firebase
    const credentials = await getMetaCredentials()
    
    const templates = await listTemplates(credentials.wabaId, credentials.businessToken)
    return Response.json({ templates })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
