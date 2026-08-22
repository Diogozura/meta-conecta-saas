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
export interface Conversa {
  numero: string
  iaAtiva: boolean
  motivoTransferencia?: string
  dataTransferencia?: Date
  // Quem pausou a IA — 'ia' é a própria IA escalando pra humano (gera aviso
  // no painel); 'manual' é um atendente respondendo direto (não gera aviso,
  // já que ele mesmo acabou de responder).
  origemTransferencia?: 'ia' | 'manual'
}

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
// Publicação Instagram (Subcoleção: contas/{contaId}/publicacoesInstagram)
// Histórico de posts/reels/vídeos/stories publicados pelo painel.
// ─────────────────────────────────────────
export interface PublicacaoInstagram {
  id: string
  contaId: string
  containerId?: string           // ID do container de mídia (Graph API)
  mediaId?: string                // ID da publicação, depois de publicada
  tipo: 'IMAGE' | 'VIDEO' | 'REELS' | 'STORIES'
  mediaUrl: string                 // URL pública usada para criar o container
  caption?: string
  status: 'enviando' | 'processando' | 'publicado' | 'falhou'
  erro?: string
  dataCriacao: Date
  publicadoEm?: Date
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
  tipo: 'recebida' | 'enviada'  // Direção da mensagem
  historico?: boolean           // true = importada via sincronização de histórico (Coexistence), não uma mensagem nova
  status?: 'enviada' | 'entregue' | 'lida' | 'falhou'  // Status (para mensagens enviadas)
  // Motivo da falha, quando status === 'falhou' — vem do webhook de status
  // da Meta (ex: código 131047 = janela de 24h expirada, precisa de template).
  erro?: { codigo?: number; mensagem: string }
  statusAtualizadoEm?: Date     // Quando `status` mudou pela última vez (webhook de status)
  dataCriacao: Date             // Data de criação no Firebase
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
