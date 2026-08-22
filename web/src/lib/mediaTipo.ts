const EXTENSOES_CONHECIDAS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
  'audio/aac': 'aac',
  'video/mp4': 'mp4',
  'video/3gpp': '3gp',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
}

/** Extensão de arquivo a partir do MIME type — usada pro nome salvo no Storage. Sem lista exaustiva: cai pro subtype do MIME (ex: "application/x-foo" -> "x-foo") quando não reconhece, e por último pra "bin". */
export function extensaoPorMime(mimeType: string): string {
  const semParametros = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (EXTENSOES_CONHECIDAS[semParametros]) return EXTENSOES_CONHECIDAS[semParametros]
  const subtype = semParametros.split('/')[1]
  return subtype || 'bin'
}

/** Classifica um MIME type recebido/a enviar num dos tipos de mídia que a Cloud API do WhatsApp aceita. */
export function tipoMidiaPorMime(mimeType: string): 'image' | 'audio' | 'video' | 'document' {
  const semParametros = mimeType.split(';')[0]?.trim().toLowerCase() ?? ''
  if (semParametros.startsWith('image/')) return 'image'
  if (semParametros.startsWith('audio/')) return 'audio'
  if (semParametros.startsWith('video/')) return 'video'
  return 'document'
}
