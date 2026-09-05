import { NextRequest, NextResponse } from 'next/server'
import {
  listarContasAtivas, listarConversas, marcarAlertaSlaEnviado,
  obterInstagramAccess, listarComentariosInstagramPendentes, marcarAlertaPendenciaComentario,
  listarMensagensInstagramPendentes, marcarAlertaPendenciaMensagem, listarPublicacoesInstagram,
} from '@/lib/firestore'
import { esperaExcedeuSla, slaParaPrioridade, SLA_ALERTA_MINUTOS } from '@/lib/conversaStatus'
import { enviarEmail, emailAlertaSla, emailPendenciasInstagram, emailRelatorioSemanalInstagram, type PendenciaInstagramItem } from '@/lib/notificacoes'
import { getAccountTotals, getFollowerGrowth, listRecentMedia } from '@/lib/instagram'
import type { Conta } from '@/types/database'

// Comentário/DM do Instagram sem resposta há mais de 1 dia vira pendência — bem maior que o
// SLA de chat ao vivo do WhatsApp (minutos), porque rede social não tem a mesma expectativa
// de resposta imediata.
const PENDENCIA_INSTAGRAM_MINUTOS = 24 * 60

async function verificarPendenciasInstagram(conta: Conta, agora: Date): Promise<number> {
  const [comentarios, mensagens] = await Promise.all([
    listarComentariosInstagramPendentes(conta.id).catch(() => []),
    listarMensagensInstagramPendentes(conta.id).catch(() => []),
  ])

  const itens: PendenciaInstagramItem[] = []
  const comentariosParaMarcar: string[] = []
  const mensagensParaMarcar: string[] = []

  for (const c of comentarios) {
    const desde = new Date(c.timestamp * 1000)
    if (!esperaExcedeuSla(desde, agora, PENDENCIA_INSTAGRAM_MINUTOS)) continue
    itens.push({ tipo: 'comentario', username: c.from, text: c.text, esperaHoras: Math.round((agora.getTime() - desde.getTime()) / 3600000) })
    comentariosParaMarcar.push(c.id)
  }
  for (const m of mensagens) {
    const desde = new Date(m.timestamp * 1000)
    if (!esperaExcedeuSla(desde, agora, PENDENCIA_INSTAGRAM_MINUTOS)) continue
    itens.push({ tipo: 'mensagem', username: m.nomeContato, text: m.text, esperaHoras: Math.round((agora.getTime() - desde.getTime()) / 3600000) })
    mensagensParaMarcar.push(m.id)
  }

  if (itens.length === 0) return 0

  const { assunto, corpoHtml } = emailPendenciasInstagram({ itens })
  const enviado = await enviarEmail({ para: conta.email, assunto, corpoHtml })
  if (!enviado) return 0

  await Promise.all([
    ...comentariosParaMarcar.map((id) => marcarAlertaPendenciaComentario(id)),
    ...mensagensParaMarcar.map((id) => marcarAlertaPendenciaMensagem(id)),
  ])
  return itens.length
}

async function enviarRelatorioSemanalSeSegunda(conta: Conta, agora: Date): Promise<boolean> {
  if (agora.getDay() !== 1) return false // só segunda-feira — o cron roda 1x/dia, então sai 1x/semana

  const credentials = await obterInstagramAccess(conta.id)
  if (!credentials) return false

  const seteDiasAtras = agora.getTime() - 7 * 24 * 60 * 60 * 1000
  const [totais, crescimento, media, publicacoes] = await Promise.all([
    getAccountTotals(credentials.accessToken, credentials.igUserId).catch(() => null),
    getFollowerGrowth(credentials.accessToken, credentials.igUserId, Math.floor(seteDiasAtras / 1000), Math.floor(agora.getTime() / 1000)).catch(() => null),
    listRecentMedia(credentials.accessToken, credentials.igUserId, 25).catch(() => []),
    listarPublicacoesInstagram(conta.id, 100).catch(() => []),
  ])

  const mediaDaSemana = media.filter((m) => m.timestamp && new Date(m.timestamp).getTime() >= seteDiasAtras)
  const curtidas = mediaDaSemana.reduce((sum, m) => sum + (m.like_count ?? 0), 0)
  const comentarios = mediaDaSemana.reduce((sum, m) => sum + (m.comments_count ?? 0), 0)
  const publicacoesNaSemana = publicacoes.filter((p) => p.status === 'publicado' && p.publicadoEm && new Date(p.publicadoEm).getTime() >= seteDiasAtras).length

  const { assunto, corpoHtml } = emailRelatorioSemanalInstagram({
    seguidores: totais?.followers_count,
    crescimentoSemana: crescimento?.net,
    curtidas,
    comentarios,
    publicacoesNaSemana,
  })
  return enviarEmail({ para: conta.email, assunto, corpoHtml })
}

/**
 * GET /api/cron/sla-alertas - Varre todas as contas ativas procurando:
 * (1) conversas de WhatsApp aguardando humano há mais tempo que o limite de SLA;
 * (2) comentários/DMs do Instagram sem resposta há mais de 1 dia ("central de pendências");
 * (3) se hoje for segunda-feira, o resumo semanal do Instagram.
 * Cada alerta só sai uma vez (campos `alertaSlaEnviadoEm`/`alertaPendenciaEnviadoEm` evitam
 * repetir a cada execução). Chamado pelo cron da Vercel (ver vercel.json), protegido por
 * `CRON_SECRET` — sem essa env var configurada, o endpoint responde 401 pra qualquer chamada.
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
  let pendenciasInstagram = 0
  let relatoriosSemanais = 0

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

      pendenciasInstagram += await verificarPendenciasInstagram(conta, agora).catch(() => 0)
      if (await enviarRelatorioSemanalSeSegunda(conta, agora).catch(() => false)) relatoriosSemanais++
    }

    return NextResponse.json({ ok: true, contasVerificadas, alertasEnviados, pendenciasInstagram, relatoriosSemanais, limiteMinutos: SLA_ALERTA_MINUTOS })
  } catch (error) {
    console.error('Erro na varredura de alertas de SLA:', error)
    return NextResponse.json({ error: 'Erro na varredura de alertas de SLA' }, { status: 500 })
  }
}
