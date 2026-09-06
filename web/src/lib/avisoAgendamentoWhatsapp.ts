/**
 * Aviso por WhatsApp "seu post sai em ~1h" — best-effort, chamado pelo cron de agendamento
 * (api/cron/instagram-publicacoes). IMPORTANTE: a Cloud API do WhatsApp só entrega mensagem de
 * texto livre iniciada pela empresa dentro da janela de 24h desde a última mensagem RECEBIDA
 * daquele número; fora disso precisaria de um template aprovado pela Meta. Por isso isso nunca
 * bloqueia nada e nunca lança — se falhar (fora da janela, número errado, WhatsApp não conectado),
 * só fica sem avisar dessa vez, sem afetar o agendamento em si.
 */

import { obterMetaAccess, atualizarPublicacaoInstagram } from '@/lib/firestore'
import { sendTextMessage } from '@/lib/meta'
import type { PublicacaoInstagram } from '@/types/database'

const TIPO_LABEL: Record<PublicacaoInstagram['tipo'], string> = {
  IMAGE: 'post',
  VIDEO: 'vídeo',
  REELS: 'Reels',
  STORIES: 'story',
  CAROUSEL: 'carrossel',
}

export async function avisarAgendamentoPorWhatsapp(contaId: string, publicacao: PublicacaoInstagram, numeroAviso: string): Promise<void> {
  try {
    const metaAccess = await obterMetaAccess(contaId)
    if (metaAccess && publicacao.agendadoPara) {
      const horario = new Date(publicacao.agendadoPara).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
      const texto = `📅 Zybot: seu ${TIPO_LABEL[publicacao.tipo]} do Instagram está agendado pra sair às ${horario} — daqui a pouco mais de 1h.`
      await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numeroAviso, texto)
    }
  } catch (err) {
    console.warn('Não foi possível enviar o aviso de agendamento por WhatsApp (best-effort):', err)
  } finally {
    // Marca como "avisado" mesmo se a tentativa falhou — evita ficar tentando de novo a cada
    // varredura do cron dentro da mesma janela (a cada ~5 min) só pra falhar de novo pelo mesmo motivo.
    await atualizarPublicacaoInstagram(contaId, publicacao.id, { avisoWhatsappEnviadoEm: new Date() }).catch(() => {})
  }
}

/** Igual à de cima, mas pro caso de "confirmação manual ativa": a hora chegou e está esperando alguém confirmar. */
export async function avisarConfirmacaoPendentePorWhatsapp(contaId: string, publicacao: PublicacaoInstagram, numeroAviso: string): Promise<void> {
  try {
    const metaAccess = await obterMetaAccess(contaId)
    if (!metaAccess) return
    const texto = `✅ Zybot: seu ${TIPO_LABEL[publicacao.tipo]} do Instagram está pronto pra publicar e esperando sua confirmação manual no painel (aba Publicar).`
    await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, numeroAviso, texto)
  } catch (err) {
    console.warn('Não foi possível enviar o aviso de confirmação pendente por WhatsApp (best-effort):', err)
  }
}
