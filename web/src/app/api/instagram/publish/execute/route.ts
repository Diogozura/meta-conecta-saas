import { NextRequest, NextResponse } from 'next/server'
import { verificarAssinaturaQstash } from '@/lib/qstash'
import { obterPublicacaoInstagram, obterConta, atualizarPublicacaoInstagram } from '@/lib/firestore'
import { criarContainerDeAgendamento, finalizarSePronto } from '@/lib/instagramPublish'
import { avisarConfirmacaoPendentePorWhatsapp } from '@/lib/avisoAgendamentoWhatsapp'

// POST /api/instagram/publish/execute - Disparado pelo Upstash QStash na hora exata de um
// agendamento (ver lib/qstash.ts::agendarPublicacaoExata). Idempotente e seguro contra disparos
// "atrasados" ou duplicados: só age se a publicação ainda estiver 'agendado' com a hora já
// vencida — se foi republicada manualmente, cancelada, ou reagendada pra mais tarde nesse meio
// tempo, só ignora (devolve 200 pro QStash não ficar retentando à toa).
export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('upstash-signature')
  const valido = await verificarAssinaturaQstash(body, signature)
  if (!valido) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }

  let payload: { contaId?: string; publicacaoId?: string }
  try {
    payload = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }
  if (!payload.contaId || !payload.publicacaoId) {
    return NextResponse.json({ error: 'contaId e publicacaoId são obrigatórios' }, { status: 400 })
  }

  const publicacao = await obterPublicacaoInstagram(payload.contaId, payload.publicacaoId)
  if (!publicacao) {
    return NextResponse.json({ ok: true, ignorado: 'publicação não encontrada' })
  }

  try {
    if (publicacao.status === 'agendado') {
      const aindaNoFuturo = publicacao.agendadoPara && new Date(publicacao.agendadoPara) > new Date()
      if (aindaNoFuturo) {
        return NextResponse.json({ ok: true, ignorado: 'reagendado pra mais tarde' })
      }
      // Pausado (férias, crise) e "confirmação manual" também valem pro disparo exato do QStash,
      // não só pra varredura do cron — senão o QStash publicaria na hora certa mesmo assim,
      // ignorando as duas configurações (aconteceu justamente por faltar essa checagem aqui).
      if (publicacao.pausado) {
        return NextResponse.json({ ok: true, ignorado: 'pausado' })
      }
      const conta = await obterConta(payload.contaId)
      if (conta?.instagramPublishConfig?.confirmacaoManualAtiva) {
        await atualizarPublicacaoInstagram(payload.contaId, payload.publicacaoId, { status: 'aguardando_confirmacao' })
        if (conta.instagramPublishConfig.numeroAvisoWhatsapp) {
          await avisarConfirmacaoPendentePorWhatsapp(payload.contaId, publicacao, conta.instagramPublishConfig.numeroAvisoWhatsapp)
        }
        return NextResponse.json({ ok: true, aguardandoConfirmacao: true })
      }
      await criarContainerDeAgendamento(payload.contaId, publicacao)
    } else if (publicacao.status === 'processando') {
      await finalizarSePronto(payload.contaId, publicacao)
    } else {
      return NextResponse.json({ ok: true, ignorado: `status já é '${publicacao.status}'` })
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro ao executar publicação agendada via QStash:', error)
    return NextResponse.json({ error: 'Erro ao publicar' }, { status: 500 })
  }
}
