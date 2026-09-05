import { NextRequest, NextResponse } from 'next/server'
import { listarContasAtivas, listarPublicacoesInstagramPendentes } from '@/lib/firestore'
import { criarContainerDeAgendamento, finalizarSePronto } from '@/lib/instagramPublish'

// GET /api/cron/instagram-publicacoes - Varre todas as contas ativas procurando
// publicações do Instagram agendadas cuja hora já chegou (cria o container e publica)
// e publicações que ficaram "processando" num tick anterior (só finaliza se pronto).
// Chamado por um scheduler externo (GitHub Actions, ver .github/workflows) a cada
// ~10 minutos — o Vercel Hobby só permite cron nativo 1x/dia. Protegido por
// `CRON_SECRET`, mesmo padrão do cron de SLA.
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurada' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  let contasVerificadas = 0
  let publicadas = 0
  let falhas = 0

  try {
    const contas = await listarContasAtivas()
    for (const conta of contas) {
      contasVerificadas++
      const pendentes = await listarPublicacoesInstagramPendentes(conta.id, agora).catch(() => [])

      for (const publicacao of pendentes) {
        const resultado = publicacao.status === 'agendado'
          ? await criarContainerDeAgendamento(conta.id, publicacao).catch((err) => ({ ...publicacao, status: 'falhou' as const, erro: String(err) }))
          : await finalizarSePronto(conta.id, publicacao).catch((err) => ({ ...publicacao, status: 'falhou' as const, erro: String(err) }))

        if (resultado.status === 'publicado') publicadas++
        else if (resultado.status === 'falhou') falhas++
      }
    }

    return NextResponse.json({ ok: true, contasVerificadas, publicadas, falhas })
  } catch (error) {
    console.error('Erro na varredura de publicações agendadas do Instagram:', error)
    return NextResponse.json({ error: 'Erro na varredura de publicações agendadas do Instagram' }, { status: 500 })
  }
}
