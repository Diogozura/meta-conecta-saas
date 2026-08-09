import { google } from 'googleapis'

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/userinfo.email', // só pra exibir qual e-mail está conectado no painel
]

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Credenciais do Google (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI) não configuradas.')
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

/** Monta a URL de consentimento OAuth. `state` carrega o profissionalId para o callback. */
export function getGoogleAuthUrl(state: string): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: 'offline', // necessário para receber refresh_token
    prompt: 'consent',      // força a devolver refresh_token mesmo em reconexões
    scope: SCOPES,
    state,
  })
}

/** Troca o code do callback OAuth por tokens. */
export async function exchangeGoogleCode(code: string): Promise<{ refreshToken: string; email?: string }> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)
  if (!tokens.refresh_token) {
    throw new Error('Google não retornou refresh_token. Revogue o acesso do app em myaccount.google.com/permissions e tente conectar novamente.')
  }

  client.setCredentials(tokens)

  // Buscar o e-mail é só cosmético (mostrar "conectado como X" no painel) —
  // se essa chamada falhar (ex: escopo ainda não propagado no Google Cloud
  // Console), a conexão do calendário em si não deve ser perdida por causa disso.
  let email: string | undefined
  try {
    const oauth2 = google.oauth2({ auth: client, version: 'v2' })
    const { data } = await oauth2.userinfo.get()
    email = data.email ?? undefined
  } catch (error) {
    console.error('Não foi possível obter o e-mail da conta Google conectada (conexão do calendário segue válida):', error)
  }

  return { refreshToken: tokens.refresh_token, email }
}

function getCalendarClient(refreshToken: string) {
  const client = getOAuthClient()
  client.setCredentials({ refresh_token: refreshToken })
  return google.calendar({ auth: client, version: 'v3' })
}

/** Consulta os intervalos ocupados no calendário do profissional (freebusy). */
export async function getFreeBusy(refreshToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<Array<{ start: Date; end: Date }>> {
  const calendar = getCalendarClient(refreshToken)
  const { data } = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  })

  const busy = data.calendars?.[calendarId]?.busy ?? []
  return busy
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }))
}

/** Cria o evento do agendamento no Google Calendar do profissional. Retorna o ID do evento criado. */
export async function createCalendarEvent(
  refreshToken: string,
  calendarId: string,
  event: { summary: string; description?: string; start: Date; end: Date },
): Promise<string> {
  const calendar = getCalendarClient(refreshToken)
  const { data } = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: event.summary,
      description: event.description,
      start: { dateTime: event.start.toISOString() },
      end: { dateTime: event.end.toISOString() },
    },
  })
  if (!data.id) {
    throw new Error('Google Calendar não retornou o ID do evento criado.')
  }
  return data.id
}

/** Remove o evento do Google Calendar (usado ao cancelar um agendamento). */
export async function deleteCalendarEvent(refreshToken: string, calendarId: string, eventId: string): Promise<void> {
  const calendar = getCalendarClient(refreshToken)
  try {
    await calendar.events.delete({ calendarId, eventId })
  } catch (err: unknown) {
    // Evento já removido diretamente no Google (ex: pelo celular) — não é um erro fatal pro cancelamento no sistema.
    const status = (err as { code?: number; response?: { status?: number } })?.response?.status ?? (err as { code?: number }).code
    if (status !== 404 && status !== 410) throw err
  }
}
