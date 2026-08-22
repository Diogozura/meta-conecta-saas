/**
 * Upload de mídia para o Firebase Storage — usado para hospedar publicamente
 * a imagem/vídeo antes de criar o container de publicação do Instagram (a
 * Graph API exige uma URL pública, não aceita upload direto de arquivo).
 */

import { getStorage } from 'firebase-admin/storage'
import { getApps } from 'firebase-admin/app'

function getBucket() {
  const apps = getApps()
  if (!apps.length) {
    throw new Error('Firebase Admin não está inicializado. Configure as variáveis de ambiente.')
  }
  return getStorage(apps[0]).bucket()
}

/** Sobe um arquivo em `instagram/{contaId}/{timestamp}.{ext}`, torna público e devolve a URL. */
export async function uploadInstagramMedia(contaId: string, buffer: Buffer, contentType: string, ext: string): Promise<string> {
  const bucket = getBucket()
  const path = `instagram/${contaId}/${Date.now()}.${ext}`
  const file = bucket.file(path)

  await file.save(buffer, { contentType, public: true })

  return `https://storage.googleapis.com/${bucket.name}/${path}`
}

/**
 * Sobe uma mídia do WhatsApp (recebida do cliente ou enviada pelo painel) em
 * `whatsapp/{contaId}/{timestamp}-{aleatorio}.{ext}`, torna pública e devolve
 * a URL — cópia permanente, já que a URL de mídia recebida que a Meta devolve
 * expira em minutos, e o envio de mídia pela Cloud API exige uma URL pública.
 */
export async function uploadWhatsappMedia(contaId: string, buffer: Buffer, contentType: string, ext: string): Promise<string> {
  const bucket = getBucket()
  const path = `whatsapp/${contaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const file = bucket.file(path)

  await file.save(buffer, { contentType, public: true })

  return `https://storage.googleapis.com/${bucket.name}/${path}`
}
