import { listarServicos, listarProfissionais, definirIaAtivaConversa } from '@/lib/firestore'
import { buscarHorariosLivres, criarAgendamentoInterno, AgendaServiceError } from '@/lib/agendaService'
import { Profissional, Servico } from '@/types/database'

// Ferramentas do agente em formato neutro (JSON Schema simples, só strings)
// — cada provedor de IA (Gemini, OpenAI, Anthropic) converte essa mesma
// lista pro formato que ele espera. A execução de fato (executarFuncaoAgente)
// também é uma só, compartilhada por todos os provedores.

export interface ToolParam {
  name: string
  description: string
  required: boolean
}

export interface ToolDef {
  name: string
  description: string
  params: ToolParam[]
}

export const FERRAMENTAS_AGENTE: ToolDef[] = [
  {
    name: 'listar_servicos',
    description: 'Lista os serviços/produtos que a empresa oferece, com nome e duração em minutos (quando aplicável, ex: para agendamentos).',
    params: [],
  },
  {
    name: 'buscar_horarios_livres',
    description: 'Busca os horários livres disponíveis para agendar um serviço em uma data específica. Use antes de oferecer qualquer horário ao cliente.',
    params: [
      { name: 'nomeServico', description: 'Nome do serviço, ex: Corte', required: true },
      { name: 'nomeProfissional', description: 'Nome do profissional (opcional — se não informado, considera qualquer um disponível para o serviço)', required: false },
      { name: 'data', description: 'Data no formato YYYY-MM-DD', required: true },
    ],
  },
  {
    name: 'criar_agendamento',
    description: 'Confirma e cria o agendamento. Só chame depois que o cliente confirmar explicitamente um horário específico que você ofereceu.',
    params: [
      { name: 'nomeServico', description: 'Nome do serviço', required: true },
      { name: 'nomeProfissional', description: 'Opcional', required: false },
      { name: 'data', description: 'YYYY-MM-DD', required: true },
      { name: 'hora', description: 'HH:MM', required: true },
      { name: 'clienteNome', description: 'Nome do cliente, perguntado na conversa', required: true },
    ],
  },
  {
    name: 'transferir_para_humano',
    description: 'Transfere a conversa para um atendente humano e para de responder automaticamente. Use quando não conseguir resolver a dúvida ou o problema do cliente sozinho, quando ele pedir explicitamente para falar com uma pessoa, ou em qualquer situação sensível (reclamação, cancelamento, cobrança, algo fora do que você sabe responder).',
    params: [
      { name: 'motivo', description: 'Resumo curto do que o cliente precisa, pro atendente entender rápido o contexto ao assumir', required: true },
    ],
  },
]

async function resolverServico(contaId: string, nomeServico: string): Promise<Servico> {
  const servicos = await listarServicos(contaId)
  const encontrado = servicos.find((s) => s.ativo && s.nome.toLowerCase().includes(nomeServico.toLowerCase()))
  if (!encontrado) throw new Error(`Serviço "${nomeServico}" não encontrado.`)
  return encontrado
}

async function resolverProfissional(contaId: string, nomeProfissional: string | undefined, servico: Servico): Promise<Profissional> {
  const profissionais = (await listarProfissionais(contaId)).filter((p) => p.ativo)

  if (nomeProfissional) {
    const encontrado = profissionais.find((p) => p.nome.toLowerCase().includes(nomeProfissional.toLowerCase()))
    if (!encontrado) throw new Error(`Profissional "${nomeProfissional}" não encontrado.`)
    return encontrado
  }

  const elegivel = profissionais.find((p) => !servico.profissionalIds?.length || servico.profissionalIds.includes(p.id))
  if (!elegivel) throw new Error(`Nenhum profissional disponível para o serviço "${servico.nome}".`)
  return elegivel
}

// O agente roda em produção num servidor UTC (Vercel), mas todo horário
// falado com o cliente e gravado pelo dono da conta é sempre em horário de
// Brasília — usar getHours()/getMinutes()/`new Date(\`${data}T${hora}\`)`
// direto pega o fuso do servidor, não o do Brasil, e desalinha em 3h só em
// produção (por isso funcionava certo local e quebrava só no ar).
const BRASIL_OFFSET_MINUTOS = -180 // America/Sao_Paulo é UTC-3 o ano todo, sem horário de verão desde 2019

/** Converte data (YYYY-MM-DD) + hora (HH:MM) no horário de Brasília pro instante UTC correto. */
function brasiliaParaData(data: string, hora: string): Date {
  const [ano, mes, dia] = data.split('-').map(Number)
  const [h, m] = hora.split(':').map(Number)
  return new Date(Date.UTC(ano, mes - 1, dia, h, m, 0) - BRASIL_OFFSET_MINUTOS * 60 * 1000)
}

/** Formata um instante como HH:MM no horário de Brasília, independente do fuso do servidor. */
function formatarHora(iso: string): string {
  const d = new Date(iso)
  const minutosNoDia = (((d.getUTCHours() * 60 + d.getUTCMinutes() + BRASIL_OFFSET_MINUTOS) % 1440) + 1440) % 1440
  return `${String(Math.floor(minutosNoDia / 60)).padStart(2, '0')}:${String(minutosNoDia % 60).padStart(2, '0')}`
}

/**
 * Bloco de contexto com a data/hora atual em Brasília, pra injetar no prompt
 * do sistema — sem isso o modelo não tem como saber "hoje" ou "amanhã" (ele
 * não sabe a data real, e o servidor roda em UTC), então uma mensagem como
 * "quero marcar pra amanhã" ficava sem base pra virar uma data de verdade.
 */
export function contextoDataAtual(): string {
  const agora = new Date()
  const dataPorExtenso = agora.toLocaleDateString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const hora = agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' })
  const isoHoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD
  return (
    `Contexto de data/hora: agora é ${dataPorExtenso}, ${hora} (horário de Brasília, GMT-3). ` +
    `Hoje no formato YYYY-MM-DD é ${isoHoje}. Use isso pra calcular datas relativas que o cliente mencionar ` +
    `("hoje", "amanhã", "depois de amanhã", "sexta que vem", "semana que vem" etc.) antes de chamar qualquer ` +
    `ferramenta que peça uma data — nunca pergunte a data exata se o cliente já disse algo relativo como esses.`
  )
}

/** Executa uma chamada de função pedida pelo modelo (qualquer provedor) e devolve o resultado. */
export async function executarFuncaoAgente(
  contaId: string,
  telefoneCliente: string,
  nome: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  try {
    switch (nome) {
      case 'listar_servicos': {
        const servicos = (await listarServicos(contaId)).filter((s) => s.ativo)
        return { servicos: servicos.map((s) => ({ nome: s.nome, duracaoMinutos: s.duracaoMinutos })) }
      }

      case 'buscar_horarios_livres': {
        const { nomeServico, nomeProfissional, data } = args as { nomeServico: string; nomeProfissional?: string; data: string }
        const servico = await resolverServico(contaId, nomeServico)
        const profissional = await resolverProfissional(contaId, nomeProfissional, servico)
        const de = brasiliaParaData(data, '00:00')
        const ate = new Date(de.getTime() + 24 * 60 * 60 * 1000 - 1000)
        const slots = await buscarHorariosLivres(contaId, profissional.id, servico.id, de, ate)
        return {
          profissional: profissional.nome,
          horarios: slots.map((s) => formatarHora(s.inicio.toISOString())),
        }
      }

      case 'criar_agendamento': {
        const { nomeServico, nomeProfissional, data, hora, clienteNome } = args as {
          nomeServico: string; nomeProfissional?: string; data: string; hora: string; clienteNome: string
        }
        const servico = await resolverServico(contaId, nomeServico)
        const profissional = await resolverProfissional(contaId, nomeProfissional, servico)
        const inicio = brasiliaParaData(data, hora)
        if (isNaN(inicio.getTime())) throw new Error('Data/hora inválida.')

        const agendamento = await criarAgendamentoInterno(contaId, {
          profissionalId: profissional.id,
          servicoId: servico.id,
          clienteNome,
          clienteTelefone: telefoneCliente,
          inicio,
          origem: 'agente_ia',
        })
        return {
          confirmado: true,
          profissional: profissional.nome,
          servico: servico.nome,
          data,
          hora: formatarHora(agendamento.inicio.toISOString()),
        }
      }

      case 'transferir_para_humano': {
        const { motivo } = args as { motivo: string }
        await definirIaAtivaConversa(contaId, telefoneCliente, false, motivo, 'ia')
        return { transferido: true }
      }

      default:
        return { erro: `Função desconhecida: ${nome}` }
    }
  } catch (error) {
    if (error instanceof AgendaServiceError) return { erro: error.message }
    return { erro: error instanceof Error ? error.message : 'Erro ao executar a ação.' }
  }
}
