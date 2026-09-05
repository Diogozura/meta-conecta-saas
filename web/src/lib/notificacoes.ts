/**
 * Envio de e-mail via API REST do Resend (https://resend.com) — sem SDK
 * extra, só `fetch`. Sem `RESEND_API_KEY` configurada, a função loga um
 * aviso e não faz nada (não quebra o chamador) — permite todo o resto do
 * app funcionar normalmente enquanto ninguém configura envio de e-mail.
 */

const RESEND_API_URL = 'https://api.resend.com/emails'

export async function enviarEmail(params: { para: string; assunto: string; corpoHtml: string }): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('RESEND_API_KEY não configurada — e-mail não enviado:', params.assunto)
    return false
  }
  const remetente = process.env.EMAIL_ALERTAS_FROM || 'alertas@resend.dev'

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remetente, to: [params.para], subject: params.assunto, html: params.corpoHtml }),
    })
    if (!res.ok) {
      console.error('Erro ao enviar e-mail via Resend:', res.status, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (error) {
    console.error('Erro ao enviar e-mail via Resend:', error)
    return false
  }
}

export function emailConviteAtendente(params: { nomeConta: string; nomeConvidado: string; urlLogin: string }): { assunto: string; corpoHtml: string } {
  return {
    assunto: `Você foi convidado para a equipe de ${params.nomeConta}`,
    corpoHtml: `
      <p>Olá, ${params.nomeConvidado}!</p>
      <p>Você foi adicionado à equipe de atendimento de <strong>${params.nomeConta}</strong>.</p>
      <p>Pra acessar, entre em <a href="${params.urlLogin}">${params.urlLogin}</a> com sua conta Google usando este e-mail — o acesso é ativado automaticamente no primeiro login.</p>
      <p style="color:#888;font-size:12px">Se você não esperava esse convite, ignore este e-mail.</p>
    `.trim(),
  }
}

export interface PendenciaInstagramItem {
  tipo: 'comentario' | 'mensagem'
  username?: string
  text: string
  esperaHoras: number
}

/** Um e-mail por conta reunindo todas as pendências do dia (não um por item) — evita spam. */
export function emailPendenciasInstagram(params: { itens: PendenciaInstagramItem[] }): { assunto: string; corpoHtml: string } {
  const linhas = params.itens
    .map((i) => `<li><strong>${i.tipo === 'comentario' ? 'Comentário' : 'Mensagem'}</strong>${i.username ? ` de @${i.username}` : ''} há ${i.esperaHoras}h sem resposta: "${i.text}"</li>`)
    .join('')
  return {
    assunto: `⚠️ ${params.itens.length} pendência${params.itens.length > 1 ? 's' : ''} no Instagram sem resposta`,
    corpoHtml: `
      <p>Você tem comentários e/ou mensagens diretas do Instagram esperando resposta há mais de um dia:</p>
      <ul>${linhas}</ul>
      <p>Acesse o painel, aba Instagram, pra responder.</p>
    `.trim(),
  }
}

export interface RelatorioSemanalInstagramParams {
  seguidores?: number
  crescimentoSemana?: number
  curtidas: number
  comentarios: number
  publicacoesNaSemana: number
}

export function emailRelatorioSemanalInstagram(params: RelatorioSemanalInstagramParams): { assunto: string; corpoHtml: string } {
  return {
    assunto: '📊 Seu resumo semanal do Instagram',
    corpoHtml: `
      <p>Resumo dos últimos 7 dias da sua conta do Instagram:</p>
      <ul>
        ${params.seguidores !== undefined ? `<li><strong>Seguidores:</strong> ${params.seguidores.toLocaleString('pt-BR')}${params.crescimentoSemana !== undefined ? ` (${params.crescimentoSemana >= 0 ? '+' : ''}${params.crescimentoSemana} na semana)` : ''}</li>` : ''}
        <li><strong>Publicações feitas:</strong> ${params.publicacoesNaSemana}</li>
        <li><strong>Curtidas recebidas:</strong> ${params.curtidas.toLocaleString('pt-BR')}</li>
        <li><strong>Comentários recebidos:</strong> ${params.comentarios.toLocaleString('pt-BR')}</li>
      </ul>
      <p>Acesse o painel, aba Instagram &gt; Métricas, pra ver mais detalhes.</p>
    `.trim(),
  }
}

export function emailAlertaSla(params: { numero: string; setor: string; esperaMinutos: number; prioridade?: 'normal' | 'alta' | 'urgente' }): { assunto: string; corpoHtml: string } {
  const prioridadeLabel = params.prioridade && params.prioridade !== 'normal' ? ` (prioridade ${params.prioridade})` : ''
  return {
    assunto: `⚠️ Cliente esperando há ${params.esperaMinutos} min — ${params.setor}${prioridadeLabel}`,
    corpoHtml: `
      <p>Uma conversa está esperando atendimento humano há mais tempo que o limite de SLA da prioridade dela.</p>
      <ul>
        <li><strong>Número:</strong> ${params.numero}</li>
        <li><strong>Setor:</strong> ${params.setor}</li>
        <li><strong>Prioridade:</strong> ${params.prioridade ?? 'normal'}</li>
        <li><strong>Esperando há:</strong> ${params.esperaMinutos} minutos</li>
      </ul>
      <p>Acesse o painel de conversas pra assumir o atendimento.</p>
    `.trim(),
  }
}
