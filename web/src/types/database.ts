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
  webhookVerifyToken: string        // Token para verificar webhooks
  embeddedSignupConfigId?: string   // Config ID do Embedded Signup (opcional)
  dataAtualizacao: Date
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
  text: string                  // Conteúdo da mensagem
  timestamp: number             // Unix timestamp em segundos (do Meta)
  tipo: 'recebida' | 'enviada'  // Direção da mensagem
  status?: 'enviada' | 'entregue' | 'lida' | 'falhou'  // Status (para mensagens enviadas)
  dataCriacao: Date             // Data de criação no Firebase
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
