import { NextRequest, NextResponse } from 'next/server'
import { listarContasAtivas, listarConversas, marcarAlertaSlaEnviado } from '@/lib/firestore'
import { esperaExcedeuSla, slaParaPrioridade, SLA_ALERTA_MINUTOS } from '@/lib/conversaStatus'
import { enviarEmail, emailAlertaSla } from '@/lib/notificacoes'

/**
 * GET /api/cron/sla-alertas - Varre todas as contas ativas procurando
 * conversas aguardando humano há mais tempo que o limite de SLA e manda um
 * e-mail (uma vez só por espera — `alertaSlaEnviadoEm` evita repetir a cada
 * execução). Chamado pelo cron da Vercel (ver vercel.json), protegido por
 * `CRON_SECRET` — sem essa env var configurada, o endpoint responde 401
 * pra qualquer chamada (não roda "aberto" por padrão).
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurada' }, { status: 401 })
  }
  if (req.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const agora = new Date()
  let alertasEnviados = 0
  let contasVerificadas = 0

  try {
    const contas = await listarContasAtivas()
    for (const conta of contas) {
      contasVerificadas++
      const conversas = await listarConversas(conta.id).catch(() => [])
      const emEspera = conversas.filter(
        (c) => !c.iaAtiva && !c.atendenteId && c.status !== 'encerrada' && c.dataTransferencia && !c.alertaSlaEnviadoEm,
      )

      for (const c of emEspera) {
        const desde = new Date(c.dataTransferencia!)
        if (!esperaExcedeuSla(desde, agora, slaParaPrioridade(c.prioridade))) continue

        const esperaMinutos = Math.round((agora.getTime() - desde.getTime()) / 60000)
        const { assunto, corpoHtml } = emailAlertaSla({ numero: c.numero, setor: c.setor || 'Fila geral', esperaMinutos, prioridade: c.prioridade })
        const enviado = await enviarEmail({ para: conta.email, assunto, corpoHtml })
        if (enviado) {
          await marcarAlertaSlaEnviado(conta.id, c.numero)
          alertasEnviados++
        }
      }
    }

    return NextResponse.json({ ok: true, contasVerificadas, alertasEnviados, limiteMinutos: SLA_ALERTA_MINUTOS })
  } catch (error) {
    console.error('Erro na varredura de alertas de SLA:', error)
    return NextResponse.json({ error: 'Erro na varredura de alertas de SLA' }, { status: 500 })
  }
}
