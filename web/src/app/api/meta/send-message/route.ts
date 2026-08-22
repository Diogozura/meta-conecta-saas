import { cookies } from 'next/headers'
import { sendTextMessage, getMetaCredentials, MetaApiError } from '@/lib/meta'
import { auth } from '@/lib/auth'
import { criarMensagem, definirIaAtivaConversa, assumirConversa, marcarConversaEmAndamento, obterConversa } from '@/lib/firestore'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'

async function requireAuth() {
  const store = await cookies()
  return !!store.get('session')
}

export async function POST(request: Request) {
  if (!(await requireAuth())) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let body: { to?: string; message?: string; assinar?: boolean }
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

    // Assinatura vai ANTES do envio — o texto que sai pro cliente já vem com o nome do atendente.
    const session = await auth()
    const textoFinal = body.assinar && session?.user?.name ? `*${session.user.name}:*\n${body.message}` : body.message

    // Responde pelo mesmo número em que o cliente escreveu, se a conta tiver
    // mais de um WhatsApp registrado — cai pro principal por padrão.
    const conversa = session?.user?.contaId ? await obterConversa(session.user.contaId, to) : null
    const phoneNumberId = resolverPhoneNumberId(credentials, conversa?.canalPhoneNumberId)

    const result = await sendTextMessage(phoneNumberId, credentials.businessToken, to, textoFinal)

    // Persiste a mensagem enviada no Firestore — antes só as RECEBIDAS
    // (via webhook) eram salvas, então o histórico nunca ficava completo.
    const messageId: string | undefined = result?.messages?.[0]?.id
    if (messageId && session?.user?.contaId) {
      try {
        await criarMensagem({
          id: messageId,
          contaId: session.user.contaId,
          from: phoneNumberId,
          to,
          text: textoFinal,
          timestamp: Math.floor(Date.now() / 1000),
          tipo: 'enviada',
          status: 'enviada',
        })

        // Um atendente respondeu manualmente — pausa a IA nessa conversa pra
        // não haver resposta automática concorrendo com o humano, e marca
        // esse atendente como quem assumiu (se a conversa ainda não tinha dono).
        await definirIaAtivaConversa(session.user.contaId, to, false, 'Atendente respondeu manualmente pelo painel', 'manual')
        if (session.user.usuarioId) {
          await assumirConversa(session.user.contaId, to, session.user.usuarioId, session.user.name)
        }
        await marcarConversaEmAndamento(session.user.contaId, to)
      } catch (persistError) {
        // Não falha o envio por causa disso — a mensagem já foi entregue à
        // Meta, só o registro de histórico que não pôde ser salvo.
        console.error('Erro ao salvar mensagem enviada no Firestore:', persistError)
      }
    }

    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof MetaApiError ? err.code : undefined
    return Response.json({ error: message, code }, { status: 502 })
  }
}
