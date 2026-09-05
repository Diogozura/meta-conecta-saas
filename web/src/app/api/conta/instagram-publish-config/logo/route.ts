import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { atualizarInstagramPublishConfig } from '@/lib/firestore'
import { uploadLogoMarca } from '@/lib/storage'

const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png'])

// POST /api/conta/instagram-publish-config/logo - Sobe o logo usado como marca d'água
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const formData = await req.formData()
  const file = formData.get('file')
  if (!(file instanceof File) || !SUPPORTED_TYPES.has(file.type)) {
    return NextResponse.json({ error: 'Envie uma imagem JPEG ou PNG.' }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { url } = await uploadLogoMarca(session.user.contaId, buffer, file.type)
    await atualizarInstagramPublishConfig(session.user.contaId, { marcaDaguaUrl: url, marcaDaguaAtiva: true })
    return NextResponse.json({ marcaDaguaUrl: url })
  } catch (error) {
    console.error('Erro ao subir o logo da marca d’água:', error)
    return NextResponse.json({ error: 'Erro ao subir o logo' }, { status: 500 })
  }
}
