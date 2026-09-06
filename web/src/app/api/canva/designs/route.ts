import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterCanvaAccessTokenValido, listDesigns, CanvaApiError } from '@/lib/canva'

// GET /api/canva/designs?query=&continuation= - Lista os designs da conta conectada no Canva
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const accessToken = await obterCanvaAccessTokenValido(session.user.contaId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Canva não conectado', naoConectado: true }, { status: 400 })
  }

  const query = req.nextUrl.searchParams.get('query') ?? undefined
  const continuation = req.nextUrl.searchParams.get('continuation') ?? undefined

  try {
    const data = await listDesigns(accessToken, query, continuation)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = err instanceof CanvaApiError ? 502 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
