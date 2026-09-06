import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterCanvaAccessTokenValido, getExportJob, CanvaApiError } from '@/lib/canva'

// GET /api/canva/export/[jobId] - Consulta o status do job de exportação. Quando termina, baixa
// o arquivo (a URL do Canva expira em 24h, não dá pra confiar nela depois) e devolve os BYTES
// direto na resposta — o navegador vira isso num File comum e segue o fluxo normal de publicação
// (recorte, marca d'água, hashtags, agendamento), sem precisar duplicar nada disso pro Canva.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params

  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const accessToken = await obterCanvaAccessTokenValido(session.user.contaId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Canva não conectado', naoConectado: true }, { status: 400 })
  }

  try {
    const { job } = await getExportJob(accessToken, jobId)

    if (job.status === 'in_progress') {
      return NextResponse.json({ status: 'in_progress' })
    }
    if (job.status === 'failed') {
      return NextResponse.json({ status: 'failed', error: job.error?.message ?? 'Exportação falhou no Canva' }, { status: 502 })
    }

    const downloadUrl = job.urls?.[0]
    if (!downloadUrl) {
      return NextResponse.json({ status: 'failed', error: 'Canva não devolveu um arquivo pra baixar' }, { status: 502 })
    }

    const arquivo = await fetch(downloadUrl)
    if (!arquivo.ok) {
      return NextResponse.json({ status: 'failed', error: 'Falha ao baixar o arquivo exportado do Canva' }, { status: 502 })
    }

    const buffer = await arquivo.arrayBuffer()
    const contentType = arquivo.headers.get('content-type') ?? 'application/octet-stream'
    return new NextResponse(buffer, { headers: { 'Content-Type': contentType, 'X-Export-Status': 'success' } })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = err instanceof CanvaApiError ? 502 : 500
    return NextResponse.json({ status: 'failed', error: message }, { status })
  }
}
