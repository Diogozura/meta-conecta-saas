import {
  atualizarAgendamento,
  criarAgendamento,
  listarAgendamentos,
  listarDisponibilidades,
  obterMetaAccess,
  obterProfissional,
  obterServico,
} from '@/lib/firestore'
import { buildAddToCalendarLink, calcularHorariosLivres, Intervalo } from '@/lib/agendaHelpers'
import { createCalendarEvent, getFreeBusy } from '@/lib/googleCalendar'
import { sendTextMessage } from '@/lib/meta'
import { Agendamento } from '@/types/database'

// Lógica de negócio da agenda compartilhada entre as rotas HTTP
// (dashboard) e o orquestrador de IA (lib/gemini.ts) — nenhum dos dois
// duplica a regra, só muda quem chama.

export class AgendaServiceError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Calcula os slots livres de um profissional para um serviço, cruzando
 * disponibilidade cadastrada + agendamentos confirmados + freebusy do Google.
 */
export async function buscarHorariosLivres(
  contaId: string,
  profissionalId: string,
  servicoId: string,
  de: Date,
  ate: Date,
): Promise<Intervalo[]> {
  const [profissional, servico] = await Promise.all([
    obterProfissional(contaId, profissionalId),
    obterServico(contaId, servicoId),
  ])

  if (!profissional) throw new AgendaServiceError('Profissional não encontrado', 404)
  if (!servico) throw new AgendaServiceError('Serviço não encontrado', 404)

  const [disponibilidades, agendamentos] = await Promise.all([
    listarDisponibilidades(contaId, profissionalId, de, ate),
    listarAgendamentos(contaId, { profissionalId, de, ate, status: 'confirmado' }),
  ])

  const ocupados: Intervalo[] = agendamentos.map((a) => ({ inicio: a.inicio, fim: a.fim }))

  if (profissional.google?.conectado) {
    try {
      const busyGoogle = await getFreeBusy(profissional.google.refreshTokenEnc, profissional.google.calendarId, de, ate)
      ocupados.push(...busyGoogle.map((b) => ({ inicio: b.start, fim: b.end })))
    } catch (error) {
      console.error('Erro ao consultar freebusy do Google, seguindo sem esses dados:', error)
    }
  }

  return calcularHorariosLivres({
    disponibilidades: disponibilidades.map((d) => ({ inicio: d.inicio, fim: d.fim })),
    ocupados,
    duracaoMinutos: servico.duracaoMinutos,
  })
}

export interface CriarAgendamentoParams {
  profissionalId: string
  servicoId: string
  clienteNome: string
  clienteTelefone: string
  inicio: Date
  origem: 'manual' | 'agente_ia'
  observacoes?: string
}

/**
 * Cria um agendamento: revalida o horário, cria o evento no Google Calendar
 * do profissional (se conectado) e dispara a notificação em tempo real —
 * mesma regra usada pelo painel e pelo agente de IA.
 */
export async function criarAgendamentoInterno(contaId: string, params: CriarAgendamentoParams): Promise<Agendamento> {
  const { profissionalId, servicoId, clienteNome, clienteTelefone, inicio, origem, observacoes } = params

  const [profissional, servico] = await Promise.all([
    obterProfissional(contaId, profissionalId),
    obterServico(contaId, servicoId),
  ])
  if (!profissional) throw new AgendaServiceError('Profissional não encontrado', 404)
  if (!servico) throw new AgendaServiceError('Serviço não encontrado', 404)

  const fim = new Date(inicio.getTime() + servico.duracaoMinutos * 60 * 1000)

  const conflitantes = await listarAgendamentos(contaId, { profissionalId, status: 'confirmado' })
  const temConflito = conflitantes.some((a) => a.inicio < fim && a.fim > inicio)
  if (temConflito) {
    throw new AgendaServiceError('Esse horário acabou de ser reservado. Escolha outro.', 409)
  }

  if (profissional.google?.conectado) {
    try {
      const busyGoogle = await getFreeBusy(profissional.google.refreshTokenEnc, profissional.google.calendarId, inicio, fim)
      const bateComGoogle = busyGoogle.some((b) => b.start < fim && b.end > inicio)
      if (bateComGoogle) {
        throw new AgendaServiceError('Esse horário está ocupado na agenda do profissional. Escolha outro.', 409)
      }
    } catch (error) {
      if (error instanceof AgendaServiceError) throw error
      console.error('Erro ao revalidar freebusy do Google antes de agendar, seguindo mesmo assim:', error)
    }
  }

  const agendamento = await criarAgendamento(contaId, {
    contaId,
    profissionalId,
    servicoId,
    clienteNome,
    clienteTelefone,
    inicio,
    fim,
    status: 'confirmado',
    origem,
    observacoes,
  })

  if (profissional.google?.conectado) {
    try {
      const googleEventId = await createCalendarEvent(profissional.google.refreshTokenEnc, profissional.google.calendarId, {
        summary: `${servico.nome} — ${clienteNome}`,
        description: `Cliente: ${clienteNome}\nWhatsApp: ${clienteTelefone}${observacoes ? `\nObs: ${observacoes}` : ''}`,
        start: inicio,
        end: fim,
      })
      await atualizarAgendamento(contaId, agendamento.id, { googleEventId })
      agendamento.googleEventId = googleEventId
    } catch (error) {
      // Agendamento já está confirmado no sistema — a falta de sync com o
      // Google não deve impedir a confirmação pro cliente. Mas grava o
      // motivo no próprio agendamento (não só no log do servidor) — quando
      // é a IA que agenda, isso roda em segundo plano via after() e ninguém
      // vê o console nesse caminho.
      const mensagemErro = error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar com o Google Calendar.'
      console.error('Erro ao criar evento no Google Calendar (agendamento já foi salvo):', error)
      await atualizarAgendamento(contaId, agendamento.id, { googleSyncError: mensagemErro.slice(0, 500) }).catch(() => {})
      agendamento.googleSyncError = mensagemErro
    }
  }

  // Manda pro cliente um link de "adicionar à agenda" (Google Calendar) por
  // WhatsApp — o cliente não loga em nada, só clica. Best-effort: se a conta
  // não tem WhatsApp conectado ou o envio falha, o agendamento já confirmado
  // não deve ser desfeito por causa disso.
  try {
    const metaAccess = await obterMetaAccess(contaId)
    if (metaAccess) {
      const link = buildAddToCalendarLink({
        titulo: `${servico.nome} — ${profissional.nome}`,
        descricao: `Agendamento com ${profissional.nome}.`,
        inicio,
        fim,
      })
      const dataHora = inicio.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
      const mensagem = `✅ Agendamento confirmado!\n\n${servico.nome} com ${profissional.nome}\n📅 ${dataHora}\n\nAdicione à sua agenda: ${link}`
      await sendTextMessage(metaAccess.phoneNumberId, metaAccess.businessToken, clienteTelefone, mensagem)
    }
  } catch (error) {
    console.error('Erro ao enviar link de agenda pro cliente via WhatsApp (agendamento já foi salvo):', error)
  }

  return agendamento
}
