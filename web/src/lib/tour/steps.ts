import type { TourStep } from './types'

export function getGlobalTourSteps(isPlatformAdmin: boolean): TourStep[] {
  const steps: TourStep[] = [
    {
      target: '[data-tour="nav-visao-geral"]',
      title: 'Visão geral',
      description: 'Seu resumo do dia: conversas em aberto, agendamentos e o que precisa de atenção agora.',
    },
    {
      target: '[data-tour="nav-conversas"]',
      title: 'Conversas',
      description: 'A caixa de entrada multicanal. Hoje o WhatsApp está ativo — Instagram e Facebook chegam em breve, tudo na mesma tela.',
    },
    {
      target: '[data-tour="nav-agenda"]',
      title: 'Agenda',
      description: 'Cadastre profissionais e serviços, defina seus dias disponíveis e acompanhe os agendamentos em um calendário visual.',
    },
  ]

  if (isPlatformAdmin) {
    steps.push({
      target: '[data-tour="nav-clientes"]',
      title: 'Clientes',
      description: 'Área exclusiva de administrador master: gerencie todas as empresas que usam a plataforma.',
    })
  }

  steps.push(
    {
      target: '[data-tour="nav-configuracoes"]',
      title: 'Configurações',
      description: 'Templates, usuários, conexão com o WhatsApp (WABA) e o agente de IA — tudo organizado aqui dentro.',
    },
    {
      target: '[data-tour="topbar-help"]',
      title: 'Precisa de ajuda?',
      description: 'Clique aqui a qualquer momento para refazer esse tour ou ver o tour da página em que você está.',
    },
  )

  return steps
}

const pageTours: Record<string, TourStep[]> = {
  '/dashboard': [
    {
      target: '[data-tour="dash-stats"]',
      title: 'Seus números',
      description: 'Acompanhe conversas ativas, agendamentos do dia e o desempenho do seu atendimento em tempo real.',
    },
    {
      target: '[data-tour="dash-quicklinks"]',
      title: 'Atalhos rápidos',
      description: 'Pule direto para as áreas que você mais usa no dia a dia.',
    },
  ],
  '/dashboard/conversas': [
    {
      target: '[data-tour="conversas-channels"]',
      title: 'Canais',
      description: 'Alterne entre canais de atendimento. WhatsApp já está conectado — Instagram e Facebook chegam em breve.',
    },
    {
      target: '[data-tour="conversas-list"]',
      title: 'Lista de conversas',
      description: 'Todos os seus contatos e o histórico de mensagens, sempre atualizado.',
    },
    {
      target: '[data-tour="conversas-ai-toggle"]',
      title: 'Agente de IA',
      description: 'Ligue ou desligue a IA por conversa. Quando ativa, ela responde automaticamente por você.',
    },
    {
      target: '[data-tour="conversas-input"]',
      title: 'Enviar mensagem',
      description: 'Responda manualmente a qualquer momento — assumir a conversa pausa a IA automaticamente.',
    },
  ],
  '/dashboard/agenda': [
    {
      target: '[data-tour="agenda-tabs"]',
      title: 'Etapas da agenda',
      description: 'Cadastre profissionais e serviços, depois defina disponibilidade e acompanhe os agendamentos.',
    },
    {
      target: '[data-tour="agenda-calendar"]',
      title: 'Calendário visual',
      description: 'Dias com bolinha verde têm horários livres. Dias com bolinha roxa já têm agendamentos. Clique em um dia para ver os detalhes.',
    },
  ],
  '/dashboard/clientes': [
    {
      target: '[data-tour="clientes-list"]',
      title: 'Empresas cadastradas',
      description: 'Gerencie todas as empresas clientes da plataforma a partir daqui.',
    },
  ],
  '/dashboard/configuracoes': [
    {
      target: '[data-tour="config-tabs"]',
      title: 'Tudo em um lugar',
      description: 'Geral, Templates, Usuários e Conectar WABA agora vivem juntos aqui em Configurações.',
    },
  ],
}

export function getPageTourSteps(pathname: string): TourStep[] {
  if (pageTours[pathname]) return pageTours[pathname]
  const prefix = Object.keys(pageTours)
    .filter((key) => key !== '/dashboard' && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0]
  return prefix ? pageTours[prefix] : []
}
