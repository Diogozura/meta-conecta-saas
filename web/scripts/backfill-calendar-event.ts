/**
 * Cria retroativamente o evento no Google Calendar de um agendamento que já
 * está confirmado no Firestore mas ficou sem googleEventId (sync falhou na
 * hora). Roda uma vez, sob demanda — não é chamado pelo app.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, cert } from 'firebase-admin/app'

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
  }),
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const firestoreLib = require('../src/lib/firestore') as typeof import('../src/lib/firestore')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const googleCalendarLib = require('../src/lib/googleCalendar') as typeof import('../src/lib/googleCalendar')

const CONTA_ID = 'yvGHJIsQeFtHAajxRTSy'
const AGENDAMENTO_ID = '49r6Mn5ydSxQuh0nvV0D' // Eduarda Pilla, 19/08

async function main() {
  const agendamento = await firestoreLib.obterAgendamento(CONTA_ID, AGENDAMENTO_ID)
  if (!agendamento) {
    console.log('Agendamento não encontrado.')
    return
  }
  if (agendamento.googleEventId) {
    console.log('Esse agendamento já tem googleEventId:', agendamento.googleEventId, '— nada a fazer.')
    return
  }
  console.log('Agendamento:', agendamento.clienteNome, agendamento.inicio, '-', agendamento.fim)

  const profissional = await firestoreLib.obterProfissional(CONTA_ID, agendamento.profissionalId)
  if (!profissional?.google?.conectado) {
    console.log('Profissional sem Google conectado — não é possível sincronizar.')
    return
  }
  const servico = await firestoreLib.obterServico(CONTA_ID, agendamento.servicoId)
  if (!servico) {
    console.log('Serviço não encontrado.')
    return
  }

  try {
    const googleEventId = await googleCalendarLib.createCalendarEvent(
      profissional.google.refreshTokenEnc,
      profissional.google.calendarId,
      {
        summary: `${servico.nome} — ${agendamento.clienteNome}`,
        description: `Cliente: ${agendamento.clienteNome}\nWhatsApp: ${agendamento.clienteTelefone}`,
        start: agendamento.inicio,
        end: agendamento.fim,
      }
    )
    await firestoreLib.atualizarAgendamento(CONTA_ID, AGENDAMENTO_ID, { googleEventId, googleSyncError: undefined })
    console.log('✅ Evento criado no Google Calendar:', googleEventId)
  } catch (error) {
    console.log('❌ Falhou ao criar o evento no Google Calendar:')
    console.log(error instanceof Error ? error.message : error)
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERRO GERAL:', e)
    process.exit(1)
  })
