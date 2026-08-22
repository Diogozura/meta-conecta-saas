import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { uploadInstagramMedia } from '@/lib/storage'

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
}

// POST /api/instagram/media/upload - Sobe uma imagem/vídeo pro Storage e devolve a URL pública
// (a API de publicação do Instagram exige uma URL pública de mídia pra criar o container).
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Arquivo "file" é obrigatório' }, { status: 400 })
  }

  const ext = EXT_BY_CONTENT_TYPE[file.type]
  if (!ext) {
    return NextResponse.json({ error: 'Formato não suportado — use JPEG, PNG, MP4 ou MOV.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const url = await uploadInstagramMedia(session.user.contaId, buffer, file.type, ext)
    return NextResponse.json({ url })
  } catch (err) {
    console.error('Erro ao subir mídia do Instagram:', err)
    return NextResponse.json({ error: 'Erro ao subir o arquivo' }, { status: 500 })
  }
}
