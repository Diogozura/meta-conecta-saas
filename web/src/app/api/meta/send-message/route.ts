import { cookies } from 'next/headers'
import { sendTextMessage, getMetaCredentials } from '@/lib/meta'
import { auth } from '@/lib/auth'
import { criarMensagem, definirIaAtivaConversa } from '@/lib/firestore'

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

    // Persiste a mensagem enviada no Firestore — antes só as RECEBIDAS
    // (via webhook) eram salvas, então o histórico nunca ficava completo.
    const messageId: string | undefined = result?.messages?.[0]?.id
    const session = await auth()
    if (messageId && session?.user?.contaId) {
      try {
        await criarMensagem({
          id: messageId,
          contaId: session.user.contaId,
          from: credentials.phoneNumberId,
          to,
          text: body.message,
          timestamp: Math.floor(Date.now() / 1000),
          tipo: 'enviada',
          status: 'enviada',
        })

        // Um atendente respondeu manualmente — pausa a IA nessa conversa pra
        // não haver resposta automática concorrendo com o humano.
        await definirIaAtivaConversa(session.user.contaId, to, false, 'Atendente respondeu manualmente pelo painel', 'manual')
      } catch (persistError) {
        // Não falha o envio por causa disso — a mensagem já foi entregue à
        // Meta, só o registro de histórico que não pôde ser salvo.
        console.error('Erro ao salvar mensagem enviada no Firestore:', persistError)
      }
    }

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    return Response.json({ error: message }, { status: 502 })
  }
}
