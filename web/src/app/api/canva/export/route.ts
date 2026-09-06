import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterCanvaAccessTokenValido, createExportJob, CanvaApiError, type CanvaExportFormat } from '@/lib/canva'

// POST /api/canva/export - Cria o job de exportação de um design (assíncrono — o front consulta
// o status em GET /api/canva/export/[jobId] até terminar).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const accessToken = await obterCanvaAccessTokenValido(session.user.contaId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Canva não conectado', naoConectado: true }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const designId = typeof body.designId === 'string' ? body.designId : null
  const tipo = body.tipo === 'video' ? 'mp4' : 'jpg'
  if (!designId) {
    return NextResponse.json({ error: 'designId é obrigatório' }, { status: 400 })
  }

  const format: CanvaExportFormat = tipo === 'mp4' ? { type: 'mp4' } : { type: 'jpg', quality: 92 }

  try {
    const { job } = await createExportJob(accessToken, designId, format)
    return NextResponse.json({ jobId: job.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = err instanceof CanvaApiError ? 502 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
