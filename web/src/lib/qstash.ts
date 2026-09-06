/**
 * Agendamento exato de publicações do Instagram via Upstash QStash — dispara
 * a publicação bem perto do minuto exato escolhido, em vez de depender só do
 * cron do GitHub Actions (que varre a cada 5 min, ver .github/workflows).
 * O cron continua existindo como rede de segurança (pega qualquer coisa que
 * o QStash não tenha conseguido registrar, por exemplo).
 */

import { Client, Receiver } from '@upstash/qstash'

function getClient(): Client | null {
  if (!process.env.QSTASH_TOKEN) return null
  return new Client({ token: process.env.QSTASH_TOKEN, baseUrl: process.env.QSTASH_URL })
}

function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zybot.com.br'
}

/**
 * Agenda o disparo exato de uma publicação. Sem CRON_SECRET/QSTASH_TOKEN configurado, não faz
 * nada (silencioso) — o cron de varredura ainda pega a publicação, só que com o atraso normal
 * dele, então não é um erro fatal deixar de agendar aqui.
 */
export async function agendarPublicacaoExata(contaId: string, publicacaoId: string, quando: Date): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('QSTASH_TOKEN não configurada — publicação vai depender só do cron de varredura.')
    return
  }

  try {
    await client.publishJSON({
      url: `${getAppUrl()}/api/instagram/publish/execute`,
      body: { contaId, publicacaoId },
      notBefore: Math.floor(quando.getTime() / 1000),
    })
  } catch (error) {
    // Best-effort — se o QStash falhar ao agendar, o cron de varredura ainda publica (com atraso).
    console.error('Erro ao agendar publicação exata no QStash:', error)
  }
}

/** Verifica a assinatura de uma requisição vinda do QStash antes de executar a publicação. */
export async function verificarAssinaturaQstash(body: string, signature: string | null): Promise<boolean> {
  if (!signature || !process.env.QSTASH_CURRENT_SIGNING_KEY) return false
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY ?? process.env.QSTASH_CURRENT_SIGNING_KEY,
  })
  try {
    return await receiver.verify({ signature, body })
  } catch {
    return false
  }
}
