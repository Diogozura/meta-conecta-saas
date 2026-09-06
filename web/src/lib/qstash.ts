/**
 * Agendamento exato de publicações do Instagram via Upstash QStash — dispara
 * a publicação bem perto do minuto exato escolhido, em vez de depender só do
 * cron do GitHub Actions (que varre a cada 5 min, ver .github/workflows).
 * O cron continua existindo como rede de segurança (pega qualquer coisa que
 * o QStash não tenha conseguido registrar, por exemplo).
 */

import { Client, Receiver } from '@upstash/qstash'
import { atualizarPublicacaoInstagram } from '@/lib/firestore'

/**
 * Tira aspas e espaços que sobram quando alguém cola um valor "KEY="valor"" direto no painel do
 * Vercel — a Vercel guarda a aspa como parte literal do valor, e isso já causou um "Invalid URL"
 * de verdade (a string virava `"https://...`, com aspa e tudo, e nenhuma URL válida começa com
 * aspa). Aplicado em toda env var usada aqui, não custa nada nas que já vêm limpas.
 */
function limparEnvVar(valor: string | undefined): string | undefined {
  return valor?.trim().replace(/^['"]+|['"]+$/g, '')
}

function getClient(): Client | null {
  const token = limparEnvVar(process.env.QSTASH_TOKEN)
  if (!token) return null
  return new Client({ token, baseUrl: limparEnvVar(process.env.QSTASH_URL) })
}

const APP_URL_PADRAO = 'https://www.zybot.com.br'

/**
 * URL pública que o QStash precisa conseguir chamar de volta. Não confia cegamente em
 * NEXT_PUBLIC_APP_URL — essa env var é usada em vários lugares só pra montar texto/metadata, então
 * pode estar configurada sem o "https://" na frente (o que já causou um erro real de "Invalid URL"
 * aqui, mesmo funcionando nos outros usos). Só aceita se vier com protocolo de verdade.
 */
function getAppUrl(): string {
  const configurado = limparEnvVar(process.env.NEXT_PUBLIC_APP_URL)
  if (configurado && /^https?:\/\//.test(configurado)) return configurado
  return APP_URL_PADRAO
}

/**
 * Agenda o disparo exato de uma publicação. Sem CRON_SECRET/QSTASH_TOKEN configurado, não faz
 * nada (silencioso) — o cron de varredura ainda pega a publicação, só que com o atraso normal
 * dele, então não é um erro fatal deixar de agendar aqui.
 */
export async function agendarPublicacaoExata(contaId: string, publicacaoId: string, quando: Date): Promise<void> {
  const client = getClient()
  if (!client) {
    const erro = 'QSTASH_TOKEN não configurada nesse ambiente — depende só do cron de varredura (5 min).'
    console.warn(erro)
    await atualizarPublicacaoInstagram(contaId, publicacaoId, { qstashErro: erro }).catch(() => {})
    return
  }

  try {
    const result = await client.publishJSON({
      url: `${getAppUrl()}/api/instagram/publish/execute`,
      body: { contaId, publicacaoId },
      notBefore: Math.floor(quando.getTime() / 1000),
    })
    await atualizarPublicacaoInstagram(contaId, publicacaoId, { qstashMessageId: result.messageId, qstashErro: null }).catch(() => {})
  } catch (error) {
    // Best-effort — se o QStash falhar ao agendar, o cron de varredura ainda publica (com atraso).
    const mensagem = error instanceof Error ? error.message : String(error)
    console.error('Erro ao agendar publicação exata no QStash:', error)
    await atualizarPublicacaoInstagram(contaId, publicacaoId, { qstashErro: mensagem }).catch(() => {})
  }
}

/** Verifica a assinatura de uma requisição vinda do QStash antes de executar a publicação. */
export async function verificarAssinaturaQstash(body: string, signature: string | null): Promise<boolean> {
  const currentKey = limparEnvVar(process.env.QSTASH_CURRENT_SIGNING_KEY)
  if (!signature || !currentKey) return false
  const receiver = new Receiver({
    currentSigningKey: currentKey,
    nextSigningKey: limparEnvVar(process.env.QSTASH_NEXT_SIGNING_KEY) ?? currentKey,
  })
  try {
    return await receiver.verify({ signature, body })
  } catch {
    return false
  }
}
