/**
 * Tipos para o banco de dados Firebase Firestore
 */

// ─────────────────────────────────────────
// Conta (Documento raiz)
// ─────────────────────────────────────────
export interface Conta {
  id: string
  nome: string
  email: string
  telefone?: string
  website?: string
  cnpj?: string
  dataCadastro: Date
  dataAtualizacao: Date
  status: 'ativo' | 'inativo' | 'suspenso'
  ai?: ContaAiConfig
  // Quais módulos essa conta pode ver/usar — controlado por um admin de
  // plataforma em /dashboard/servicos. AUSENTE (não `{}`) = conta legada ou
  // nunca configurada por um admin, trata como acesso total (não bloqueia
  // ninguém por padrão); só passa a restringir depois que um admin define
  // esse campo explicitamente pra essa conta. Ver lib/servicos.ts.
  servicosContratados?: ServicosContratados
  // Colunas do Kanban do CRM leve — ausente/vazio = usa ETAPAS_PADRAO
  // (ver lib/funil.ts), mesmo padrão "ausente = default" do resto da conta.
  funilEtapas?: FunilEtapa[]
  // Marca d'água e assinatura padrão aplicadas nas publicações do Instagram
  // (ver PublishTab.tsx) — configurável por conta, não por publicação.
  instagramPublishConfig?: InstagramPublishConfig
}

export interface InstagramPublishConfig {
  assinatura?: string
  assinaturaAtiva?: boolean
  marcaDaguaUrl?: string
  marcaDaguaAtiva?: boolean
  // Guia de marca (cores/fontes/tom de voz) mostrado como referência na hora de escrever a
  // legenda (PublishTab) — não é aplicado automaticamente em nada, é só consulta.
  guiaDeMarca?: {
    cores?: string[]
    fontes?: string[]
    tomDeVoz?: string
  }
  // Palavras/termos que essa conta nunca quer ver numa legenda (nome de concorrente, gíria fora
  // do tom da marca, termo sensível do nicho etc.) — checado ao vivo em PublishTab, ver lib/textoRiscos.ts.
  termosProibidos?: string[]
  // Fuso horário (nome IANA, ex: "America/Sao_Paulo") usado pra interpretar os campos de data/hora
  // de agendamento — ver lib/fusoHorario.ts. Ausente = comportamento de sempre (fuso do navegador
  // de quem está agendando), sem mudança de comportamento pra quem nunca configurou isso.
  fusoHorario?: string
  // Número de WhatsApp (E.164, ex: "5511999999999") avisado ~1h antes de cada publicação sair —
  // best-effort, ver PublicacaoInstagram.avisoWhatsappEnviadoEm.
  numeroAvisoWhatsapp?: string
  // Em vez de publicar sozinho na hora agendada, o cron para em 'aguardando_confirmacao' e espera
  // alguém confirmar manualmente (ver api/instagram/publications/[id]/confirmar).
  confirmacaoManualAtiva?: boolean
  // Oculta automaticamente (não apaga) um comentário novo que bate com algum termo dessa lista —
  // ver lib/moderacaoComentarios.ts. Some da lista de moderação, além dos termos padrão fixos.
  moderacaoAutomaticaAtiva?: boolean
  termosModeracao?: string[]
  // Resposta automática por IA (Gemini) quando um comentário/DM bate com alguma pergunta
  // frequente cadastrada (ver PerguntaFrequenteInstagram) — nunca responde automaticamente fora
  // desse casamento (não é um agente livre como o do WhatsApp).
  faqAtiva?: boolean
}

export interface ServicosContratados {
  whatsapp: boolean
  agenda: boolean
  instagram: boolean
  crm: boolean
  tickets: boolean
}

// Etapa de funil configurável pela conta (CRM leve) — ex: "Novo lead", "Em
// negociação", "Fechado". A ORDEM no array é a ordem das colunas do Kanban;
// não tem um campo `ordem` separado pra não arriscar dessincronizar.
export interface FunilEtapa {
  id: string
  nome: string
  cor: string
}

// Configuração do agente de IA que responde as mensagens do WhatsApp
// automaticamente (Gemini, com function calling sobre a agenda). apiKey é
// segredo real (chave da própria conta do cliente) — sempre criptografada
// antes de gravar, mesmo padrão do businessToken/appSecret da Meta.
export interface ContaAiConfig {
  enabled: boolean
  provider: 'gemini' | 'openai' | 'anthropic'
  model: string
  prompt: string
  apiKey: string
  /** Texto livre sobre o negócio (o que vende/atende, horários, endereço,
   *  políticas, perguntas frequentes) — entra no prompt do agente pra ele
   *  responder dúvidas gerais, não só sobre agenda. */
  informacoesNegocio?: string
  /** Erro da última tentativa de responder (ex: cota da API estourada) —
   *  permite avisar no painel que a IA está ativa mas não está respondendo,
   *  em vez de falhar em silêncio só no log do servidor. Limpo a cada
   *  resposta bem-sucedida ou ao salvar essa configuração novamente. */
  ultimoErro?: string
  ultimoErroEm?: string
}

// ─────────────────────────────────────────
// Conversa (Subcoleção: contas/{contaId}/conversas)
// Estado de controle por número de telefone — principalmente se a IA está
// respondendo automaticamente ou se um atendente humano assumiu.
// ─────────────────────────────────────────
// aberta = recebeu mensagem mas ainda não teve nenhuma resposta (IA ou
// humano); em_andamento = já houve resposta e não foi encerrada; encerrada =
// atendente fechou explicitamente. Uma mensagem nova numa conversa encerrada
// reabre ela (volta pra 'aberta').
export type ConversaStatus = 'aberta' | 'em_andamento' | 'encerrada'

export interface Conversa {
  numero: string
  // Ausente = conversas antigas, criadas antes desse campo existir — trate
  // como 'em_andamento' na UI (não são novas nem foram encerradas).
  status?: ConversaStatus
  abertaEm?: Date
  encerradaEm?: Date
  encerradaPor?: string // usuarioId de quem encerrou, ou 'sistema'

  iaAtiva: boolean
  motivoTransferencia?: string
  dataTransferencia?: Date
  // Quem pausou a IA — 'ia' é a própria IA escalando pra humano (gera aviso
  // no painel); 'manual' é um atendente respondendo direto (não gera aviso,
  // já que ele mesmo acabou de responder).
  origemTransferencia?: 'ia' | 'manual'

  // Atendente que assumiu a conversa (reivindicação explícita, distinta de
  // simplesmente desativar a IA) — enquanto ausente com iaAtiva=false, a
  // conversa está "aguardando humano" na fila.
  atendenteId?: string
  atendenteNome?: string
  assumidoEm?: Date

  // Nó do Fluxo (ver abaixo) onde essa conversa está parada aguardando
  // resposta do cliente — ausente/null = fluxo não iniciado ou já terminou
  // (conversa seguiu pra IA, humano, ou fim de fluxo).
  fluxoNoAtualId?: string | null
  // Em qual Fluxo (id do documento) essa conversa está progredindo —
  // ausente/null = o fluxo ATIVO da conta (comportamento de sempre). Só
  // aponta pra outro fluxo depois de um nó "ir_para_fluxo" (salto direto,
  // sem volta — ver lib/fluxoService.ts).
  fluxoAtualId?: string | null
  // Setor/departamento atribuído por um nó "encaminhar_humano" do fluxo
  // (ex: "Suporte técnico", "Financeiro", "Vendas") — usado pra segmentar a
  // fila de atendimento humano por equipe, não só "todo mundo numa fila só".
  setor?: string | null

  // Prioridade na fila — 'urgente'/'alta' furam a ordem de chegada (FIFO só
  // vale dentro da mesma prioridade). Preenchido automaticamente quando o
  // Cliente correspondente ao número tem a tag "VIP" (ver lib/clienteLookup.ts),
  // ou manualmente pelo atendente.
  prioridade?: 'normal' | 'alta' | 'urgente'

  // Respostas capturadas por nós "coleta" do Fluxo, indexadas pela chave
  // (FluxoNode.variavel) — ex: { cpf: "123.456.789-00" }. Persistem mesmo
  // depois que a conversa segue pra IA/humano, pra dar contexto.
  dadosColetados?: Record<string, string>

  // Timestamp do último e-mail de alerta de SLA estourado já enviado pra
  // essa conversa — evita reenviar a cada execução do cron enquanto ela
  // continuar esperando (ver api/cron/sla-alertas).
  alertaSlaEnviadoEm?: Date | null

  // true logo depois de mandar a pergunta de satisfação (CSAT) ao encerrar
  // a conversa — a PRÓXIMA mensagem do cliente é interpretada como a nota
  // (0-10), não repassada pro fluxo/IA. Ver lib/csatService.ts.
  aguardandoCsat?: boolean

  // Qual número da conta (MetaAccess.phoneNumberId ou um de
  // numerosAdicionais) o cliente está usando pra falar com essa conta —
  // preenchido a partir do metadata do webhook. Toda resposta futura sai
  // pelo mesmo número, em vez de sempre o principal (ver lib/canalWhatsapp.ts).
  canalPhoneNumberId?: string | null

  // Etiquetas adicionadas por um nó "adicionar_etiqueta" do fluxo — só
  // acumula, sem duplicar (ver lib/firestore.ts adicionarEtiquetaConversa).
  etiquetas?: string[]
  // Gerado por um nó "gerar_protocolo" do fluxo — número curto pro cliente
  // referenciar esse atendimento depois.
  protocolo?: string

  // Coluna do Kanban do CRM leve em que essa conversa está — ausente/id que
  // não existe mais na lista de FunilEtapa da conta = trata como a
  // PRIMEIRA etapa (ver lib/funil.ts), não como "sem funil".
  etapaFunilId?: string | null
}

// ─────────────────────────────────────────
// Ticket (Subcoleção: contas/{contaId}/tickets) — chamado de suporte/SAC,
// separado da Conversa: uma Conversa é o estado do chat "ao vivo" (só um
// por número), um Ticket é um caso com vida própria — o mesmo número pode
// abrir vários tickets ao longo do tempo (ex: 3 chamados técnicos em meses
// diferentes), cada um com seu protocolo e histórico de status.
// ─────────────────────────────────────────
export type TicketStatus = 'aberto' | 'em_andamento' | 'resolvido' | 'fechado'
export type TicketPrioridade = 'baixa' | 'normal' | 'alta' | 'urgente'

export interface Ticket {
  id: string
  // Vincula ao número de WhatsApp da Conversa OU (quando origem === 'instagram') ao @usuário do
  // Instagram — o nome do campo ficou genérico por compatibilidade com tickets já existentes.
  numero: string
  origem?: 'whatsapp' | 'instagram' // ausente = 'whatsapp' (todo ticket criado antes desse campo existir)
  assunto: string
  descricao?: string
  protocolo: string
  status: TicketStatus
  prioridade: TicketPrioridade
  criadoEm: Date
  atualizadoEm: Date
  // Preenchido quando o status vira 'resolvido' ou 'fechado' — null se reaberto depois.
  resolvidoEm?: Date | null
  // 'sistema' (aberto por um nó "criar_ticket" do fluxo) ou usuarioId de quem abriu manualmente.
  criadoPor: string
  atendenteId?: string | null
  atendenteNome?: string | null
}

// ─────────────────────────────────────────
// AvaliacaoCsat (Subcoleção: contas/{contaId}/avaliacoesCsat) — nota de
// satisfação (0-10, estilo NPS) que o cliente dá ao responder a pergunta
// enviada automaticamente quando uma conversa é encerrada.
// ─────────────────────────────────────────
export interface AvaliacaoCsat {
  id: string
  numero: string
  nota: number
  criadoEm: Date
}

// ─────────────────────────────────────────
// Fluxo (Subcoleção: contas/{contaId}/fluxos) — árvore de decisão estática
// (menus, mensagens, encaminhamentos) que guia o início do atendimento antes
// do agente de IA livre assumir. Hoje: um fluxo só por conta (doc "principal"),
// com um botão liga/desliga (`ativo`) — sem fluxo configurado ou desligado,
// o comportamento é o de sempre (mensagem vai direto pro agente de IA).
// ─────────────────────────────────────────
export type FluxoNodeTipo =
  | 'inicio' | 'mensagem' | 'menu' | 'horario' | 'coleta' | 'encaminhar_ia' | 'encaminhar_humano' | 'fim'
  // Pacote "mensageria essencial" — cada um dá um passo automático (como
  // 'mensagem') e segue pra próxima aresta, exceto 'solicitar_localizacao'
  // (para e espera, como 'coleta').
  | 'enviar_template' | 'enviar_url' | 'enviar_email' | 'nota_interna' | 'solicitar_localizacao' | 'gerar_qrcode' | 'adicionar_etiqueta' | 'gerar_protocolo'
  // Pacote "lógica e variáveis" — 'definir_variavel' e 'pausar' são passos
  // automáticos (como 'mensagem'); 'condicao_variavel' tem duas saídas fixas
  // ("verdadeiro"/"falso"), igual 'horario' tem "dentro"/"fora".
  | 'definir_variavel' | 'condicao_variavel' | 'pausar'
  // 'ir_para_fluxo' — encerra este fluxo e entra em outro (salto direto, sem
  // "voltar" — o fluxo de destino é quem decide como a conversa termina).
  | 'ir_para_fluxo'
  // 'mover_etapa_funil' — passo automático (como 'mensagem') que move a
  // conversa pra uma coluna do Kanban do CRM leve. Ver types/database.ts FunilEtapa.
  | 'mover_etapa_funil'
  // 'criar_ticket' — passo automático (como 'mensagem') que abre um Ticket de
  // suporte (usa `texto` do nó como assunto) e confirma o protocolo pro cliente.
  | 'criar_ticket'

export type OperadorCondicao = 'igual' | 'diferente' | 'contem' | 'vazio' | 'preenchido' | 'maior' | 'menor'

// Horário de Brasília (America/Sao_Paulo) — 0=domingo...6=sábado, mesmo índice usado no resto do app (ex: WEEKDAY_LABELS da Agenda).
export interface FluxoHorario {
  diasSemana: boolean[]
  horaInicio: string // "HH:mm"
  horaFim: string // "HH:mm"
}

export interface FluxoNode {
  id: string
  tipo: FluxoNodeTipo
  posicao: { x: number; y: number }
  // Conteúdo depende do tipo — 'mensagem'/'menu'/'coleta' usam `texto`
  // (a pergunta, no caso de 'coleta'); 'menu' usa também `opcoes` (o que o
  // cliente precisa digitar pra seguir por cada aresta, cada uma virando um
  // "handle" — ponto de saída — no nó); 'horario' usa `horario` (a mesma
  // ideia de handle nomeado, com duas saídas fixas: "dentro"/"fora");
  // 'coleta' usa também `variavel` (a chave onde a resposta livre do
  // cliente é guardada em Conversa.dadosColetados); 'encaminhar_humano' usa
  // `setor`/`motivo`. Os demais tipos ('inicio', 'encaminhar_ia', 'fim')
  // não têm conteúdo extra.
  texto?: string
  opcoes?: { id: string; rotulo: string }[]
  horario?: FluxoHorario
  // 'coleta' e 'solicitar_localizacao' usam `variavel` pra saber a chave em Conversa.dadosColetados onde guardar a resposta.
  variavel?: string
  setor?: string
  motivo?: string
  // Pacote "mensageria essencial" — cada campo é usado só pelo tipo indicado:
  templateNome?: string        // 'enviar_template' — nome do template aprovado na Meta
  url?: string                 // 'enviar_url' — destino do botão (texto do corpo vem de `texto`)
  botaoLabel?: string          // 'enviar_url' — rótulo do botão (até ~20 caracteres, limite da Cloud API)
  emailDestinatario?: string   // 'enviar_email' — endereço literal ou "{{variavel}}" coletada antes no fluxo
  emailAssunto?: string        // 'enviar_email' (corpo vem de `texto`)
  estiloNota?: 'info' | 'alerta' // 'nota_interna' (conteúdo vem de `texto`) — só aparece pro atendente, nunca vai pro WhatsApp
  etiqueta?: string            // 'adicionar_etiqueta' — rótulo adicionado a Conversa.etiquetas
  // Pacote "lógica e variáveis":
  // 'definir_variavel' usa `variavel` (chave) + `texto` (valor, aceita "{{outra_chave}}").
  // 'condicao_variavel' usa `variavel` (chave a checar) + `operador` + `valorComparacao`.
  operador?: OperadorCondicao
  valorComparacao?: string
  pausaSegundos?: number       // 'pausar' — limitado a alguns segundos (função serverless, não é um agendador de verdade)
  fluxoDestinoId?: string      // 'ir_para_fluxo' — id de outro Fluxo dessa mesma conta
  etapaFunilId?: string        // 'mover_etapa_funil' — id de uma FunilEtapa da conta
}

export interface FluxoEdge {
  id: string
  origem: string // FluxoNode.id
  destino: string // FluxoNode.id
  // Handle de saída do nó de origem que essa aresta usa — em nós 'menu', é
  // o id de uma opção (FluxoNode.opcoes[].id); em nós 'horario', é a string
  // fixa 'dentro' ou 'fora'. Ausente em nós com uma única saída (mensagem, inicio).
  opcaoId?: string
}

export interface Fluxo {
  id: string
  contaId: string
  nome: string
  ativo: boolean
  nodes: FluxoNode[]
  edges: FluxoEdge[]
  dataCadastro: Date
  dataAtualizacao: Date
}

/**
 * Valor de `Conversa.fluxoNoAtualId` que marca "essa conversa já foi
 * entregue pro agente de IA ou pra fila humana pelo fluxo — não reentrar no
 * menu nas próximas mensagens". Diferente de `null`/ausente, que significa
 * "fluxo ainda não começou" (ou foi resetado por uma reabertura da conversa).
 */
export const FLUXO_SAIU = '__saiu__'

// ─────────────────────────────────────────
// Usuario (Subcoleção: contas/{contaId}/usuarios)
// ─────────────────────────────────────────
export enum NivelUsuario {
  PROPRIETARIO = 'proprietario',  // Acesso total, controla tudo
  ADMIN = 'admin',                // Controla usuários, templates, números
  OPERADOR = 'operador',          // Envia mensagens, gerencia conversas
  VISUALIZADOR = 'visualizador',  // Apenas leitura
}

export interface Usuario {
  id: string
  contaId: string
  nome: string
  email: string
  avatar?: string
  nivel: NivelUsuario
  dataAcesso?: Date       // Último acesso
  dataCadastro: Date
  dataAtualizacao: Date
  status: 'ativo' | 'inativo' | 'convite_pendente'
  // Setor/departamento desse atendente (ex: "Financeiro", "Suporte técnico")
  // — usado pelo round-robin do fluxo de atendimento pra saber quem pode
  // receber uma conversa encaminhada pra cada setor. Sem setor definido, o
  // usuário não entra em nenhuma rotação automática (só assume manualmente).
  setor?: string | null
  // Autenticação em dois fatores (TOTP, RFC 6238) — `totpSecret` só existe
  // criptografado em repouso (mesmo padrão do businessToken da Meta) e NUNCA
  // deve ser enviado ao cliente já logado; `totpAtivo` é o único campo que a
  // UI precisa saber. Ver lib/auth.ts (verificação no login) e
  // api/auth/2fa/**.
  totpSecret?: string
  totpAtivo?: boolean
}

// ─────────────────────────────────────────
// EventoAtendimento (Subcoleção: contas/{contaId}/eventosAtendimento) — log
// append-only de transições da conversa, usado pra métricas HISTÓRICAS (a
// diferença do endpoint de métricas "ao vivo", que só olha o estado atual).
// ─────────────────────────────────────────
export type TipoEventoAtendimento = 'aberta' | 'transferida_humano' | 'assumida' | 'liberada' | 'encerrada'

export interface EventoAtendimento {
  id: string
  numero: string
  tipo: TipoEventoAtendimento
  setor?: string | null
  atendenteId?: string | null
  atendenteNome?: string | null
  criadoEm: Date
}

// ─────────────────────────────────────────
// RespostaRapida (Subcoleção: contas/{contaId}/respostasRapidas) — modelos
// de mensagem prontos pro atendente inserir no chat com um clique.
// ─────────────────────────────────────────
export interface RespostaRapida {
  id: string
  contaId: string
  atalho: string // ex: "saudacao" — só pra identificar na lista, não precisa ser único
  texto: string
  dataCadastro: Date
}

// ─────────────────────────────────────────
// ConjuntoHashtags (Subcoleção: contas/{contaId}/conjuntosHashtags) — grupos
// de hashtags prontos pra inserir na legenda do Instagram com 1 clique.
// ─────────────────────────────────────────
export interface ConjuntoHashtags {
  id: string
  contaId: string
  nome: string // ex: "Promoção" — só pra identificar na lista
  hashtags: string // texto livre, ex: "#promo #moda #ofertas"
  dataCadastro: Date
}

// ─────────────────────────────────────────
// ModeloLegenda (Subcoleção: contas/{contaId}/modelosLegenda) — estrutura de
// legenda reutilizável (gancho + corpo + chamada pra ação) pro Instagram.
// ─────────────────────────────────────────
export interface ModeloLegenda {
  id: string
  contaId: string
  nome: string // ex: "Lançamento de produto" — só pra identificar na lista
  gancho: string
  corpo: string
  cta: string
  dataCadastro: Date
}

// ─────────────────────────────────────────
// RegistroAuditoria (Subcoleção: contas/{contaId}/auditoria) — log
// append-only de quem mudou o quê nas configurações sensíveis da conta
// (fluxo de atendimento, respostas rápidas, equipe/atendentes). Não cobre
// TUDO no sistema, só o que afeta como a conta atende os clientes.
// ─────────────────────────────────────────
export type AuditoriaEntidade =
  | 'fluxo' | 'resposta_rapida' | 'atendente' | 'dados_cliente' | 'conjunto_hashtags' | 'modelo_legenda'
  | 'instagram_conta' | 'instagram_publicacao' | 'instagram_config'
export type AuditoriaAcao = 'criar' | 'atualizar' | 'excluir' | 'ativar' | 'convidar'

export interface RegistroAuditoria {
  id: string
  contaId: string
  entidade: AuditoriaEntidade
  entidadeId?: string
  acao: AuditoriaAcao
  descricao: string // resumo pronto pra exibir, ex: "Ativou o fluxo 'Atendimento padrão'"
  usuarioId: string
  usuarioNome: string
  criadoEm: Date
}

// ─────────────────────────────────────────
// MetaAccess (Subcoleção: contas/{contaId}/metaAccess)
// Credenciais de integração com Meta/WhatsApp Business API
// ─────────────────────────────────────────
export interface MetaAccess {
  id: string
  wabaId: string                    // WhatsApp Business Account ID
  phoneNumberId: string             // ID do número de telefone principal
  businessToken: string             // Business Access Token (do Embedded Signup)
  appId: string                     // Meta App ID
  appSecret: string                 // Meta App Secret
  // Não usado pelo webhook (que valida contra a env var global
  // META_WEBHOOK_VERIFY_TOKEN, compartilhada por todas as contas) — campo
  // legado, mantido só pra não quebrar leitura de documentos antigos.
  webhookVerifyToken?: string
  embeddedSignupConfigId?: string   // Config ID do Embedded Signup (opcional)
  // true = número conectado no modo Coexistence (também segue em uso no app
  // WhatsApp Business do celular). Por conta — outras contas continuam no
  // fluxo normal (só Cloud API) sem nenhum impacto.
  coexistence?: boolean
  // Preenchido quando a Meta avisa (webhook account_update, evento
  // PARTNER_REMOVED) que o dono desconectou a integração direto pelo
  // celular — nesse caso a conta continua salva, mas precisa reconectar.
  // Limpo (null) automaticamente na próxima conexão bem-sucedida.
  desconectadoEm?: Date | null
  dataAtualizacao: Date
  // Números extras registrados na MESMA WABA/token (ex: um número por loja
  // física) — o principal continua sendo `phoneNumberId` acima. Mensagens
  // recebidas em qualquer um chegam pelo mesmo webhook (a Meta identifica só
  // pela WABA); a resposta sai pelo número em que o cliente escreveu (ver
  // Conversa.canalPhoneNumberId e lib/canalWhatsapp.ts).
  numerosAdicionais?: { phoneNumberId: string; nome: string }[]
}

// ─────────────────────────────────────────
// InstagramAccess (Subcoleção: contas/{contaId}/instagramAccess)
// Credenciais de integração com a conta profissional do Instagram —
// conectada via "Business Login for Instagram" (OAuth direto, sem precisar
// de Página do Facebook no meio, diferente do fluxo do WhatsApp).
// ─────────────────────────────────────────
export interface InstagramAccess {
  id: string
  igUserId: string           // ID da conta no Instagram (Instagram-scoped user ID)
  username: string
  accountType?: string       // BUSINESS | CREATOR
  profilePictureUrl?: string
  accessToken: string        // Long-lived token (60 dias) — sempre criptografado antes de gravar
  tokenExpiraEm?: Date       // Quando o long-lived token vence (renovável a partir de 24h antes)
  desconectadoEm?: Date | null
  dataAtualizacao: Date
}

// ─────────────────────────────────────────
// CanvaAccess (Subcoleção: contas/{contaId}/canvaAccess) — token OAuth do
// Canva Connect API, usado só pra importar um design pronto pra publicar no
// Instagram (ver PublishTab.tsx). Mesmo padrão do InstagramAccess.
// ─────────────────────────────────────────
export interface CanvaAccess {
  id: string
  accessToken: string   // sempre criptografado antes de gravar
  refreshToken: string  // idem — cada refresh token só pode ser usado 1 vez, é trocado a cada renovação
  expiraEm: Date
  dataAtualizacao: Date
}

// ─────────────────────────────────────────
// Mensagem Instagram (Coleção global: mensagensInstagram)
// Mesmo formato de Mensagem (WhatsApp), mas para DMs do Instagram — coleção
// separada em vez de reaproveitar `mensagens` pra não arriscar o caminho
// estável do WhatsApp (índices, polling, IA) ao mexer nele.
// ─────────────────────────────────────────
export interface MensagemInstagram {
  id: string                    // ID da mensagem no Instagram
  contaId: string
  conversationId: string        // ID da conversa (thread) no Instagram
  from: string                  // Instagram-scoped ID de quem enviou
  to?: string                   // Instagram-scoped ID do destinatário (mensagens enviadas)
  nomeContato?: string
  fotoContato?: string
  text: string
  timestamp: number             // Unix timestamp em segundos
  tipo: 'recebida' | 'enviada'
  // Dedupe do alerta de "pendência" (DM sem resposta há muito tempo) — só
  // marcado na mensagem 'recebida' mais recente de cada conversationId.
  alertaPendenciaEnviadoEm?: Date
  dataCriacao: Date
}

// ─────────────────────────────────────────
// Comentário Instagram (Coleção global: comentariosInstagram)
// ─────────────────────────────────────────
export interface ComentarioInstagram {
  id: string                    // ID do comentário no Instagram
  contaId: string
  mediaId: string                // ID da publicação comentada
  from: string                   // username de quem comentou
  fromId?: string                // Instagram-scoped ID de quem comentou
  text: string
  timestamp: number
  respondido?: boolean
  // Dedupe do alerta de "pendência" (comentário sem resposta há muito tempo)
  // — mesmo padrão de alertaSlaEnviadoEm em Conversa, evita reenviar todo dia.
  alertaPendenciaEnviadoEm?: Date
  // Ocultado automaticamente (moderação por termo banido/spam ou usuário bloqueado — ver
  // lib/moderacaoComentarios.ts) ou manualmente pelo painel. `true` = comentário some da vista
  // pública no Instagram, mas continua existindo (não é o mesmo que apagar).
  oculto?: boolean
  ocultoMotivo?: string
  dataCriacao: Date
}

// ─────────────────────────────────────────
// Menção Instagram (Coleção global: mencoesInstagram)
// Só existe a partir do momento em que o webhook avisa de uma menção — a
// Graph API não permite listar menções antigas, então não há histórico
// anterior à conexão da conta.
// ─────────────────────────────────────────
export interface MencaoInstagram {
  id: string                    // ID do comentário ou da mídia mencionada (dedupe)
  contaId: string
  tipo: 'comentario' | 'legenda'
  mediaId?: string
  text?: string
  username?: string
  timestamp: number
  dataCriacao: Date
}

// ─────────────────────────────────────────
// Usuário bloqueado do Instagram (Subcoleção: contas/{contaId}/instagramBloqueados,
// doc id = username) — a Graph API pro login direto do Instagram NÃO expõe nenhum endpoint de
// "bloquear usuário" de verdade (isso só existe dentro do app do Instagram). "Bloquear" aqui é
// moderação do lado do Zybot: comentários novos desse usuário são ocultados automaticamente
// (ver lib/instagram.ts::hideComment), e o painel mostra um aviso nas DMs dele.
// ─────────────────────────────────────────
export interface InstagramBloqueado {
  id: string // username, sem o @
  motivo?: string
  criadoEm: Date
}

// ─────────────────────────────────────────
// Pergunta frequente (Subcoleção: contas/{contaId}/perguntasFrequentesInstagram) — base pra
// resposta automática por IA em comentários/DMs (ver InstagramPublishConfig.faqAtiva).
// ─────────────────────────────────────────
export interface PerguntaFrequenteInstagram {
  id: string
  pergunta: string
  resposta: string
}

// ─────────────────────────────────────────
// Publicação Instagram (Subcoleção: contas/{contaId}/publicacoesInstagram)
// Histórico de posts/reels/vídeos/stories publicados pelo painel.
// ─────────────────────────────────────────
export interface PublicacaoInstagramMediaItem {
  url: string
  path: string
  isVideo: boolean
}

export interface PublicacaoInstagram {
  id: string
  contaId: string
  containerId?: string           // ID do container de mídia (Graph API)
  mediaId?: string                // ID da publicação, depois de publicada
  tipo: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES' | 'CAROUSEL'
  mediaPath?: string               // Caminho no Vercel Blob (só foto) — usado pra apagar o arquivo temporário depois
  mediaPaths?: string[]            // Mesma coisa, mas pra carrossel (um por foto)
  coverPath?: string               // Caminho no Vercel Blob da capa personalizada (só Reels)
  // Rascunho/agendamento: arquivo(s) já hospedados desde a criação (URL + path
  // pro Blob), porque o container na Meta só é criado na hora de publicar de
  // verdade (containers não publicados expiram em 24h na API da Meta).
  mediaItems?: PublicacaoInstagramMediaItem[]
  coverItem?: { url: string; path: string }
  itemCount?: number               // Quantidade de itens do carrossel
  caption?: string
  altText?: string
  collaborators?: string[]
  isAiGenerated?: boolean
  shareToFeed?: boolean            // Só Reels: também aparece no Feed além da aba Reels
  // aguardando_confirmacao: a hora chegou, mas a conta tem "confirmação manual" ativa
  // (InstagramPublishConfig.confirmacaoManualAtiva) — fica parado aqui até alguém confirmar
  // manualmente (ver api/instagram/publications/[id]/confirmar), em vez de publicar sozinho.
  status: 'rascunho' | 'agendado' | 'aguardando_confirmacao' | 'enviando' | 'processando' | 'publicado' | 'falhou'
  agendadoPara?: Date | null       // Quando o cron deve publicar (status 'agendado')
  // Pausa temporária (férias, crise) — o cron pula qualquer coisa com isso true, mesmo já vencida;
  // continua 'agendado' pro resto da UI, só não é pega pela varredura enquanto pausado.
  pausado?: boolean
  // Best-effort — não é garantia de entrega (a Cloud API do WhatsApp só manda texto livre dentro
  // da janela de 24h desde a última mensagem recebida daquele número; fora disso precisaria de um
  // template aprovado). Marcado só pra não mandar o aviso 2x no mesmo agendamento.
  avisoWhatsappEnviadoEm?: Date | null
  // Diagnóstico do agendamento exato (QStash) — ajuda a saber, direto no painel, se o disparo
  // exato foi mesmo registrado ou se a publicação vai depender só da varredura do cron a cada
  // 5 min (ver lib/qstash.ts). Um limpa o outro dependendo do resultado da última tentativa.
  qstashMessageId?: string | null
  qstashErro?: string | null
  erro?: string
  dataCriacao: Date
  publicadoEm?: Date
  // Checklist de conformidade: a pessoa confirmou ter os direitos de uso da mídia (imagem/vídeo/
  // música) antes de publicar/agendar — guardado pra auditoria, não é só um "risco" de UI.
  direitosAutoraisConfirmado?: boolean
  // Cópia de backup permanente no Vercel Blob (nunca apagada) — só existe quando o arquivo
  // original NÃO passa pela hospedagem própria durante a publicação normal (vídeo publicado na
  // hora vai direto pra Meta via upload resumable, sem tocar no nosso Blob). Nos outros casos
  // (foto publicada na hora, e qualquer rascunho/agendamento), o próprio mediaPath(s)/mediaItems/
  // coverPath(Item) já servem de backup — deixam de ser apagados depois de publicar.
  backupItems?: { url: string; path: string }[]
}

// Snapshot da legenda/texto alternativo/colaboradores ANTES de uma edição — subcoleção
// contas/{contaId}/publicacoesInstagram/{id}/versoes, gravada a cada PATCH que muda algum desses
// campos. Permite desfazer uma edição de rascunho/agendamento (ver PublishTab.tsx).
export interface VersaoPublicacaoInstagram {
  id: string
  caption?: string
  altText?: string
  collaborators?: string[]
  criadoEm: Date
}

// Horário fixo reutilizável ("toda terça às 18h") — Subcoleção: contas/{contaId}/horariosFixosInstagram.
// Só uma conveniência pra preencher o campo de agendamento mais rápido; não agenda nada sozinho.
export interface HorarioFixoInstagram {
  id: string
  label: string
  diaSemana: number   // 0 (domingo) a 6 (sábado)
  horario: string     // "HH:mm"
}

// ─────────────────────────────────────────
// ContaVinculada (Subcoleção: contas/{contaId}/contasVinculadas)
// Para gerenciar contas "filhas" ou parceiros
// ─────────────────────────────────────────
export enum NivelVinculacao {
  CONTROLADA = 'controlada',        // Conta pai controla totalmente
  PARCEIRO = 'parceiro',            // Acesso limitado
  RESELLER = 'reseller',            // Pode criar subcontas
}

export interface ContaVinculada {
  id: string
  contaId: string                   // Conta "pai"
  contaVinculadaId: string          // Conta "filha" ou parceira
  nivel: NivelVinculacao
  dataCadastro: Date
  dataAtualizacao: Date
  status: 'ativo' | 'inativo'
}

// ─────────────────────────────────────────
// Cliente (Subcoleção: contas/{contaId}/clientes)
// ─────────────────────────────────────────
export interface Cliente {
  id: string
  contaId: string
  nome: string
  email?: string
  telefone?: string
  whatsapp?: string          // Número do WhatsApp
  instagram?: string         // @usuário do Instagram (sem o @)
  tag?: string               // Lead, Cliente, Inativo, etc.
  notas?: string
  dataCadastro: Date
  dataAtualizacao: Date
  status: 'ativo' | 'inativo'
}

// ─────────────────────────────────────────
// Mensagem WhatsApp (Coleção global: mensagens)
// ─────────────────────────────────────────
export interface Mensagem {
  id: string                    // ID da mensagem do WhatsApp
  contaId: string               // Conta que recebeu/enviou
  clienteId?: string            // ID do cliente (se identificado)
  from: string                  // Número de telefone de origem (5511999999999)
  to?: string                   // Número de telefone de destino (para mensagens enviadas)
  nomeContato?: string          // Nome cadastrado pelo contato no WhatsApp (vem no payload do webhook)
  text: string                  // Conteúdo da mensagem
  timestamp: number             // Unix timestamp em segundos (do Meta)
  // 'nota' = nota interna gerada por um nó "nota_interna" do fluxo — nunca
  // sai pro WhatsApp, só aparece no painel pro atendente. Não tem `id` real
  // da Meta (gerado localmente) nem entra no histórico que a IA vê.
  tipo: 'recebida' | 'enviada' | 'nota'
  estiloNota?: 'info' | 'alerta'
  historico?: boolean           // true = importada via sincronização de histórico (Coexistence), não uma mensagem nova
  status?: 'enviada' | 'entregue' | 'lida' | 'falhou'  // Status (para mensagens enviadas)
  // Motivo da falha, quando status === 'falhou' — vem do webhook de status
  // da Meta (ex: código 131047 = janela de 24h expirada, precisa de template).
  erro?: { codigo?: number; mensagem: string }
  statusAtualizadoEm?: Date     // Quando `status` mudou pela última vez (webhook de status)
  dataCriacao: Date             // Data de criação no Firebase
  // Mídia (foto, áudio, vídeo, documento, figurinha) — recebida do cliente ou
  // enviada pelo painel. Sem Firebase Storage (plano gratuito não inclui):
  // só guarda o ID da mídia na Meta, que fica hospedada lá — o painel busca
  // os bytes sob demanda via /api/whatsapp/midia/[mediaId] (ver esse route
  // e lib/meta.ts). Pra mídia enviada PELO painel, o mesmo `mediaId` vem da
  // resposta do upload direto pra Meta (sem link público nenhum).
  mediaId?: string
  mediaType?: 'image' | 'audio' | 'video' | 'document' | 'sticker'
  mediaMimeType?: string
  mediaFilename?: string        // Nome original do arquivo (documentos)
}

// ─────────────────────────────────────────
// Profissional (Subcoleção: contas/{contaId}/profissionais)
// ─────────────────────────────────────────
export interface Profissional {
  id: string
  contaId: string
  nome: string
  telefone?: string
  ativo: boolean
  google?: {
    conectado: boolean
    calendarId: string        // "primary" por padrão
    refreshTokenEnc: string   // criptografado (mesmo padrão do MetaAccess)
    email?: string
  }
  dataCadastro: Date
  dataAtualizacao: Date
}

// ─────────────────────────────────────────
// Servico (Subcoleção: contas/{contaId}/servicos)
// ─────────────────────────────────────────
export interface Servico {
  id: string
  contaId: string
  nome: string
  duracaoMinutos: number
  profissionalIds?: string[]  // vazio/ausente = qualquer profissional atende
  ativo: boolean
  dataCadastro: Date
  dataAtualizacao: Date
}

// ─────────────────────────────────────────
// Disponibilidade (Subcoleção: contas/{contaId}/disponibilidades)
// Bloco avulso de data/hora em que um profissional está disponível
// ─────────────────────────────────────────
export interface Disponibilidade {
  id: string
  contaId: string
  profissionalId: string
  inicio: Date
  fim: Date
  dataCadastro: Date
}

// ─────────────────────────────────────────
// Agendamento (Subcoleção: contas/{contaId}/agendamentos)
// ─────────────────────────────────────────
export interface Agendamento {
  id: string
  contaId: string
  profissionalId: string
  servicoId: string
  clienteNome: string
  clienteTelefone: string
  inicio: Date
  fim: Date                    // calculado: inicio + servico.duracaoMinutos
  status: 'confirmado' | 'cancelado' | 'concluido'
  origem: 'manual' | 'agente_ia'
  googleEventId?: string
  // Preenchido quando o agendamento foi confirmado mas o sync com o Google
  // Calendar falhou — assim dá pra saber e reprocessar sem depender de log
  // do servidor (que a IA, rodando em segundo plano via after(), não expõe).
  googleSyncError?: string
  observacoes?: string
  dataCriacao: Date
  dataAtualizacao: Date
}

// ─────────────────────────────────────────
// Sessão (para controle de acesso no app)
// ─────────────────────────────────────────
export interface SessaoUsuario {
  usuarioId: string
  contaId: string
  email: string
  nome: string
  nivel: NivelUsuario
  dataLogin: Date
}
