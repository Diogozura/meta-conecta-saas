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
// Dados de integração com Meta/WhatsApp Business API
// ─────────────────────────────────────────
export interface MetaAccess {
  id: string
  contaId: string
  wabaId: string                    // WhatsApp Business Account ID
  accessToken: string               // Token de acesso Meta (criptografado em prod)
  businessId: string                // Business ID
  phoneNumberIds: string[]          // IDs dos números vinculados
  dataAtualizacao: Date
  dataExpiracao?: Date              // Quando o token expira
  status: 'ativo' | 'expirado' | 'erro'
  webhookToken?: string             // Token para validar webhooks
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
