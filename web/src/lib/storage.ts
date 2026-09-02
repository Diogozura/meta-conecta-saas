/**
 * Upload de imagem para o Vercel Blob — usado para hospedar temporariamente
 * a foto antes de criar o container de publicação do Instagram (a Graph API
 * exige uma URL pública pra foto; vídeo/reels/story em vídeo não passam por
 * aqui, vão direto pra Meta via resumable upload — ver instagram.ts).
 *
 * Usa o Vercel Blob (e não Firebase Storage ou outro serviço terceiro)
 * porque o app já roda na Vercel: sem cadastro novo, sem cartão no plano
 * Hobby, e o arquivo é apagado logo depois de publicado.
 */

import { put, del } from '@vercel/blob'

/**
 * Sobe uma foto em `instagram/{contaId}/{timestamp}[-suffix]` e devolve a URL pública do Blob.
 * O `suffix` evita colisão de nome quando várias fotos de um carrossel (ou a capa de um Reels)
 * são enviadas no mesmo milissegundo.
 */
export async function uploadInstagramPhoto(
  contaId: string,
  buffer: Buffer,
  contentType: string,
  suffix?: string,
): Promise<{ url: string; path: string }> {
  const ext = contentType === 'image/png' ? 'png' : 'jpg'
  const pathname = `instagram/${contaId}/${Date.now()}${suffix ? `-${suffix}` : ''}.${ext}`

  const blob = await put(pathname, buffer, {
    access: 'public',
    contentType,
    addRandomSuffix: false,
  })

  return { url: blob.url, path: blob.pathname }
}

/** Apaga a foto temporária depois que a Meta já buscou/processou — best-effort, nunca lança. */
export async function deleteInstagramPhoto(path: string): Promise<void> {
  try {
    await del(path)
  } catch (err) {
    console.warn('Não foi possível apagar a foto temporária do Instagram (Vercel Blob):', path, err)
  }
}
