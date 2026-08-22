import { getMetaCredentials, MetaApiError, sendMediaMessage } from '@/lib/meta'
import { auth } from '@/lib/auth'
import { criarMensagem, definirIaAtivaConversa, assumirConversa, marcarConversaEmAndamento, obterConversa } from '@/lib/firestore'
import { resolverPhoneNumberId } from '@/lib/canalWhatsapp'
import { uploadWhatsappMedia } from '@/lib/storage'
import { extensaoPorMime, tipoMidiaPorMime } from '@/lib/mediaTipo'

// Limite da própria Cloud API do WhatsApp por tipo (imagem/áudio 16 MB, vídeo 16 MB, documento 100 MB) — aplica o mais restritivo aqui pra simplificar.
const TAMANHO_MAXIMO_BYTES = 16 * 1024 * 1024

// POST /api/meta/send-media - Envia uma imagem/áudio/vídeo/documento pro cliente (multipart/form-data: file, to, caption?, assinar?)
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return Response.json({ error: 'Não autorizado' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return Response.json({ error: 'Body inválido' }, { status: 400 })
  }

  const file = form.get('file')
  const to = (form.get('to') as string | null)?.replace(/\D/g, '') ?? ''
  const caption = (form.get('caption') as string | null)?.trim() || undefined
  const assinar = form.get('assinar') === 'true'

  if (!(file instanceof File) || !to || to.length < 10) {
    return Response.json({ error: 'Campos "file" e "to" são obrigatórios' }, { status: 400 })
  }
  if (file.size > TAMANHO_MAXIMO_BYTES) {
    return Response.json({ error: 'Arquivo muito grande — limite de 16 MB' }, { status: 413 })
  }

  try {
    const credentials = await getMetaCredentials()
    const conversa = await obterConversa(session.user.contaId, to)
    const phoneNumberId = resolverPhoneNumberId(credentials, conversa?.canalPhoneNumberId)

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || 'application/octet-stream'
    const tipo = tipoMidiaPorMime(mimeType)
    const mediaUrl = await uploadWhatsappMedia(session.user.contaId, buffer, mimeType, extensaoPorMime(mimeType))

    const legendaFinal = assinar && session.user.name ? `*${session.user.name}:*${caption ? `\n${caption}` : ''}` : caption
    const nomeArquivo = tipo === 'document' ? file.name : undefined

    const result = await sendMediaMessage(phoneNumberId, credentials.businessToken, to, tipo, mediaUrl, { caption: legendaFinal, filename: nomeArquivo })

    const messageId: string | undefined = result?.messages?.[0]?.id
    if (messageId) {
      await criarMensagem({
        id: messageId,
        contaId: session.user.contaId,
        from: phoneNumberId,
        to,
        text: legendaFinal ?? (tipo === 'document' ? `📎 ${file.name}` : ''),
        timestamp: Math.floor(Date.now() / 1000),
        tipo: 'enviada',
        status: 'enviada',
        mediaUrl,
        mediaType: tipo,
        mediaMimeType: mimeType,
        ...(nomeArquivo ? { mediaFilename: nomeArquivo } : {}),
      }).catch((persistError) => {
        console.error('Erro ao salvar mensagem de mídia enviada no Firestore:', persistError)
      })

      await definirIaAtivaConversa(session.user.contaId, to, false, 'Atendente respondeu manualmente pelo painel', 'manual').catch(() => {})
      if (session.user.usuarioId) {
        await assumirConversa(session.user.contaId, to, session.user.usuarioId, session.user.name).catch(() => {})
      }
      await marcarConversaEmAndamento(session.user.contaId, to).catch(() => {})
    }

    return Response.json({ ...result, mediaUrl, mediaType: tipo })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const code = err instanceof MetaApiError ? err.code : undefined
    return Response.json({ error: message, code }, { status: 502 })
  }
}
