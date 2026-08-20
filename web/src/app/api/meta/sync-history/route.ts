import { getMetaCredentials, syncSmbAppData } from '@/lib/meta'

// Dispara a sincronização de contatos + histórico de mensagens pro número
// conectado em modo Coexistence. Precisa ser chamado em até 24h depois do
// onboarding (janela imposta pela Meta) — o resultado chega depois via
// webhook (campo "history").
export async function POST() {
  try {
    const credentials = await getMetaCredentials()

    // A Meta exige sincronizar os contatos antes do histórico de mensagens.
    await syncSmbAppData(credentials.phoneNumberId, credentials.businessToken, 'smb_app_state_sync')
    await syncSmbAppData(credentials.phoneNumberId, credentials.businessToken, 'history')

    return Response.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido'
    const status = message.includes('autenticado') || message.includes('configuradas') ? 401 : 502
    return Response.json({ error: message }, { status })
  }
}
