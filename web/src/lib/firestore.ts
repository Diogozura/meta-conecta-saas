/**
 * Serviços para interação com Firebase Firestore
 * Use em Server Components ou Server Actions apenas
 */

import { getFirestore, Timestamp, Query, Filter } from 'firebase-admin/firestore'
import { getApps } from 'firebase-admin/app'
import { Conta, ContaAiConfig, Usuario, MetaAccess, ContaVinculada, Cliente, Mensagem, Profissional, Servico, Disponibilidade, Agendamento, Conversa } from '@/types/database'
import { encrypt, decrypt } from '@/lib/crypto'

// Garante que apenas uma instância do Firestore é inicializada
// Firebase Admin já foi inicializado em lib/firebase-admin.ts
function getDb() {
  const apps = getApps()

  if (!apps || apps.length === 0) {
    console.error('❌ Firebase Admin não inicializado! Verifique as variáveis de ambiente:')
    console.error('   - FIREBASE_PROJECT_ID')
    console.error('   - FIREBASE_CLIENT_EMAIL')
    console.error('   - FIREBASE_PRIVATE_KEY')
    throw new Error('Firebase Admin não está inicializado. Configure as variáveis de ambiente.')
  }
  
  const db = getFirestore(apps[0], 'zybot-data')
  
  // Log de debug para verificar a inicialização
  if (!db) {
    console.error('❌ Firestore não inicializado!')
    throw new Error('Firestore não está disponível')
  }
  
  return db
}

// Converte campos Timestamp do Firestore Admin em Date antes de devolver ao front,
// caso contrário `new Date(timestamp)` no cliente vira "Invalid Date".
function convertTimestamps<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data }
  for (const key of ['dataCadastro', 'dataAtualizacao', 'dataCriacao', 'inicio', 'fim']) {
    const value = result[key]
    if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
      result[key] = value.toDate()
    }
  }
  return result as T
}

// ─────────────────────────────────────────
// CONTAS
// ─────────────────────────────────────────
//
// ai.apiKey é a chave da API do Gemini de cada cliente — segredo real,
// sempre criptografado antes de gravar e descriptografado só na leitura,
// mesmo padrão do businessToken/appSecret do MetaAccess.

function encryptContaAiSecrets<T extends { ai?: Partial<ContaAiConfig> }>(data: T): T {
  if (!data.ai?.apiKey) return data
  return { ...data, ai: { ...data.ai, apiKey: encrypt(data.ai.apiKey) } }
}

function decryptContaAiSecrets(conta: Conta): Conta {
  if (!conta.ai?.apiKey) return conta
  return { ...conta, ai: { ...conta.ai, apiKey: decrypt(conta.ai.apiKey) } }
}

export async function criarConta(data: Omit<Conta, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Conta> {
  const db = getDb()
  const now = Timestamp.now()
  
  console.log('📝 Criando conta:', data)
  
  try {
    const docRef = await db.collection('contas').add({
      ...data,
      dataCadastro: now,
      dataAtualizacao: now,
    })
    
    console.log('✅ Conta criada com ID:', docRef.id)
    
    return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string; stack?: string }
    console.error('❌ Erro detalhado ao criar conta:', {
      code: err.code,
      message: err.message,
      stack: err.stack
    })
    throw error
  }
}

export async function obterConta(contaId: string): Promise<Conta | null> {
  const db = getDb()
  const docSnap = await db.collection('contas').doc(contaId).get()
  if (!docSnap.exists) return null
  return decryptContaAiSecrets({ id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Conta)
}

/** Usado para evitar criar uma conta duplicada para quem já tem uma (ver api/meta/credentials/route.ts). */
export async function obterContaPorEmail(email: string): Promise<Conta | null> {
  const db = getDb()
  const snapshot = await db.collection('contas').where('email', '==', email).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...convertTimestamps(doc.data()) } as Conta
}

export async function atualizarConta(contaId: string, data: Partial<Omit<Conta, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).update({
    ...encryptContaAiSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

/**
 * Registra (ou limpa, passando null) o erro da última tentativa do agente de
 * IA — usa caminho de campo (ai.ultimoErro) em vez de reescrever o objeto
 * `ai` inteiro, pra não apagar provider/apiKey/prompt já salvos.
 */
export async function registrarErroAgenteIA(contaId: string, erro: string | null): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).update({
    'ai.ultimoErro': erro,
    'ai.ultimoErroEm': erro ? new Date().toISOString() : null,
  })
}

// ─────────────────────────────────────────
// USUÁRIOS
// ─────────────────────────────────────────

export async function criarUsuario(contaId: string, data: Omit<Usuario, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Usuario> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('usuarios').add({
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function obterUsuario(contaId: string, usuarioId: string): Promise<Usuario | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('usuarios').doc(usuarioId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Usuario
  } catch {
    return null
  }
}

export async function listarUsuarios(contaId: string): Promise<Usuario[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('usuarios').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Usuario))
}

export async function atualizarUsuario(contaId: string, usuarioId: string, data: Partial<Omit<Usuario, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('usuarios').doc(usuarioId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
}

// ─────────────────────────────────────────
// ÍNDICE uid -> contaId/usuarioId
// ─────────────────────────────────────────
//
// `auth()` (lib/auth.ts) precisa resolver o contaId do usuário logado a
// partir do uid da sessão Firebase. Sem um índice, isso exigia escanear a
// coleção inteira de "contas" e, para cada uma, consultar a subcoleção
// "usuarios" por e-mail — um custo O(n) de leituras a cada requisição
// autenticada, que estourou a cota gratuita do Firestore em produção.
// Este índice guarda o atalho uid -> {contaId, usuarioId}, populado sob
// demanda (lazy) na primeira vez que o scan legado resolve um usuário.

export interface IndiceUsuario {
  contaId: string
  usuarioId: string
  email: string
}

export async function obterIndiceUsuarioPorUid(uid: string): Promise<IndiceUsuario | null> {
  const db = getDb()
  const docSnap = await db.collection('usuarioContaIndex').doc(uid).get()
  if (!docSnap.exists) return null
  return docSnap.data() as IndiceUsuario
}

export async function salvarIndiceUsuarioPorUid(uid: string, entry: IndiceUsuario): Promise<void> {
  const db = getDb()
  await db.collection('usuarioContaIndex').doc(uid).set(entry)
}

// ─────────────────────────────────────────
// META ACCESS
// ─────────────────────────────────────────
//
// businessToken e appSecret são segredos reais da Meta (token de acesso e
// chave do app) — sempre criptografados antes de gravar, e descriptografados
// só na leitura. decrypt() é compatível com registros antigos gravados em
// texto puro (devolve o valor como está se não reconhecer o formato cifrado).

function encryptMetaAccessSecrets<T extends { businessToken?: string; appSecret?: string }>(data: T): T {
  return {
    ...data,
    ...(data.businessToken ? { businessToken: encrypt(data.businessToken) } : {}),
    ...(data.appSecret ? { appSecret: encrypt(data.appSecret) } : {}),
  }
}

function decryptMetaAccessSecrets(data: MetaAccess): MetaAccess {
  return {
    ...data,
    businessToken: data.businessToken ? decrypt(data.businessToken) : data.businessToken,
    appSecret: data.appSecret ? decrypt(data.appSecret) : data.appSecret,
  }
}

export async function criarMetaAccess(contaId: string, data: Omit<MetaAccess, 'id' | 'dataAtualizacao'>): Promise<MetaAccess> {
  const db = getDb()
  const docRef = await db.collection('contas').doc(contaId).collection('metaAccess').add({
    ...encryptMetaAccessSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
  return { id: docRef.id, ...data, dataAtualizacao: new Date() }
}

export async function obterMetaAccess(contaId: string): Promise<MetaAccess | null> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('metaAccess').limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return decryptMetaAccessSecrets({ id: doc.id, ...convertTimestamps(doc.data()) } as MetaAccess)
}

/**
 * Busca MetaAccess por WABA ID (usado em webhooks)
 */
export async function obterMetaAccessPorWabaId(wabaId: string): Promise<{ metaAccess: MetaAccess; contaId: string } | null> {
  const db = getDb()

  // Caminho rápido: collection group query indexada por wabaId — evita
  // varrer todas as contas a cada mensagem recebida. Precisa de um índice
  // composto (Firestore cria sozinho na primeira falha, com um link direto
  // no erro/log). Enquanto o índice não existir, cai no fallback abaixo, que
  // sempre funciona (só é mais lento com muitas contas).
  try {
    const rapida = await db.collectionGroup('metaAccess').where('wabaId', '==', wabaId).limit(1).get()
    if (!rapida.empty) {
      const doc = rapida.docs[0]
      const contaId = doc.ref.parent.parent?.id
      if (contaId) {
        return { metaAccess: decryptMetaAccessSecrets({ id: doc.id, ...doc.data() } as MetaAccess), contaId }
      }
    } else {
      return null
    }
  } catch (error) {
    console.warn('collectionGroup em metaAccess falhou (provavelmente falta criar o índice — veja o link no erro), usando fallback de varredura completa:', error)
  }

  // Fallback: varredura completa conta por conta.
  const contasSnapshot = await db.collection('contas').get()

  for (const contaDoc of contasSnapshot.docs) {
    const metaSnapshot = await contaDoc.ref.collection('metaAccess')
      .where('wabaId', '==', wabaId)
      .limit(1)
      .get()

    if (!metaSnapshot.empty) {
      const metaDoc = metaSnapshot.docs[0]
      return {
        metaAccess: decryptMetaAccessSecrets({ id: metaDoc.id, ...metaDoc.data() } as MetaAccess),
        contaId: contaDoc.id
      }
    }
  }

  return null
}

export async function atualizarMetaAccess(contaId: string, accessId: string, data: Partial<Omit<MetaAccess, 'id'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('metaAccess').doc(accessId).update({
    ...encryptMetaAccessSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

// ─────────────────────────────────────────
// CONTAS VINCULADAS
// ─────────────────────────────────────────

export async function criarContaVinculada(contaId: string, data: Omit<ContaVinculada, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<ContaVinculada> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('contasVinculadas').add({
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function listarContasVinculadas(contaId: string): Promise<ContaVinculada[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('contasVinculadas').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as ContaVinculada))
}

// ─────────────────────────────────────────
// CLIENTES
// ─────────────────────────────────────────

export async function criarCliente(contaId: string, data: Omit<Cliente, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Cliente> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('clientes').add({
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function obterCliente(contaId: string, clienteId: string): Promise<Cliente | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('clientes').doc(clienteId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Cliente
  } catch {
    return null
  }
}

export async function listarClientes(contaId: string): Promise<Cliente[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('clientes').orderBy('dataCadastro', 'desc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Cliente))
}

export async function atualizarCliente(contaId: string, clienteId: string, data: Partial<Omit<Cliente, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('clientes').doc(clienteId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
}

export async function deletarCliente(contaId: string, clienteId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('clientes').doc(clienteId).delete()
}

// ─────────────────────────────────────────
// PROFISSIONAIS
// ─────────────────────────────────────────
//
// refreshTokenEnc (dentro de `google`) é o refresh token OAuth do Google
// Calendar do profissional — segredo real, sempre criptografado antes de
// gravar e descriptografado só na leitura, mesmo padrão do MetaAccess.

function encryptProfissionalSecrets<T extends { google?: Profissional['google'] }>(data: T): T {
  if (!data.google?.refreshTokenEnc) return data
  return {
    ...data,
    google: { ...data.google, refreshTokenEnc: encrypt(data.google.refreshTokenEnc) },
  }
}

function decryptProfissionalSecrets(data: Profissional): Profissional {
  if (!data.google?.refreshTokenEnc) return data
  return {
    ...data,
    google: { ...data.google, refreshTokenEnc: decrypt(data.google.refreshTokenEnc) },
  }
}

export async function criarProfissional(contaId: string, data: Omit<Profissional, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Profissional> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('profissionais').add({
    ...encryptProfissionalSecrets(data),
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function obterProfissional(contaId: string, profissionalId: string): Promise<Profissional | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('profissionais').doc(profissionalId).get()
    if (!docSnap.exists) return null
    return decryptProfissionalSecrets({ id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Profissional)
  } catch {
    return null
  }
}

export async function listarProfissionais(contaId: string): Promise<Profissional[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('profissionais').orderBy('dataCadastro', 'desc').get()
  return snapshot.docs.map(doc => decryptProfissionalSecrets({ id: doc.id, ...convertTimestamps(doc.data()) } as Profissional))
}

export async function atualizarProfissional(contaId: string, profissionalId: string, data: Partial<Omit<Profissional, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('profissionais').doc(profissionalId).update({
    ...encryptProfissionalSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

export async function deletarProfissional(contaId: string, profissionalId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('profissionais').doc(profissionalId).delete()
}

// ─────────────────────────────────────────
// SERVICOS
// ─────────────────────────────────────────

export async function criarServico(contaId: string, data: Omit<Servico, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Servico> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('servicos').add({
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function obterServico(contaId: string, servicoId: string): Promise<Servico | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('servicos').doc(servicoId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Servico
  } catch {
    return null
  }
}

export async function listarServicos(contaId: string): Promise<Servico[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('servicos').orderBy('dataCadastro', 'desc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Servico))
}

export async function atualizarServico(contaId: string, servicoId: string, data: Partial<Omit<Servico, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('servicos').doc(servicoId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
}

export async function deletarServico(contaId: string, servicoId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('servicos').doc(servicoId).delete()
}

// ─────────────────────────────────────────
// DISPONIBILIDADES
// ─────────────────────────────────────────

export async function criarDisponibilidade(contaId: string, data: Omit<Disponibilidade, 'id' | 'dataCadastro'>): Promise<Disponibilidade> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('disponibilidades').add({
    ...data,
    inicio: Timestamp.fromDate(data.inicio),
    fim: Timestamp.fromDate(data.fim),
    dataCadastro: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate() }
}

/** Lista blocos de disponibilidade de um profissional, opcionalmente filtrando por intervalo. */
export async function listarDisponibilidades(contaId: string, profissionalId: string, de?: Date, ate?: Date): Promise<Disponibilidade[]> {
  const db = getDb()
  let query = db.collection('contas').doc(contaId).collection('disponibilidades')
    .where('profissionalId', '==', profissionalId)
    .orderBy('inicio', 'asc')

  if (de) query = query.where('inicio', '>=', Timestamp.fromDate(de))
  if (ate) query = query.where('inicio', '<=', Timestamp.fromDate(ate))

  const snapshot = await query.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Disponibilidade))
}

export async function atualizarDisponibilidade(contaId: string, disponibilidadeId: string, data: { inicio: Date; fim: Date }): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('disponibilidades').doc(disponibilidadeId).update({
    inicio: Timestamp.fromDate(data.inicio),
    fim: Timestamp.fromDate(data.fim),
  })
}

export async function obterDisponibilidade(contaId: string, disponibilidadeId: string): Promise<Disponibilidade | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('disponibilidades').doc(disponibilidadeId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Disponibilidade
  } catch {
    return null
  }
}

export async function deletarDisponibilidade(contaId: string, disponibilidadeId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('disponibilidades').doc(disponibilidadeId).delete()
}

// ─────────────────────────────────────────
// AGENDAMENTOS
// ─────────────────────────────────────────

export async function criarAgendamento(contaId: string, data: Omit<Agendamento, 'id' | 'dataCriacao' | 'dataAtualizacao'>): Promise<Agendamento> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('agendamentos').add({
    ...data,
    inicio: Timestamp.fromDate(data.inicio),
    fim: Timestamp.fromDate(data.fim),
    dataCriacao: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCriacao: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function obterAgendamento(contaId: string, agendamentoId: string): Promise<Agendamento | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('agendamentos').doc(agendamentoId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Agendamento
  } catch {
    return null
  }
}

/** Lista agendamentos de uma conta, com filtros opcionais por profissional, intervalo e status. */
export async function listarAgendamentos(contaId: string, filtros: { profissionalId?: string; de?: Date; ate?: Date; status?: Agendamento['status'] } = {}): Promise<Agendamento[]> {
  const db = getDb()
  let query = db.collection('contas').doc(contaId).collection('agendamentos').orderBy('inicio', 'asc') as Query

  if (filtros.profissionalId) query = query.where('profissionalId', '==', filtros.profissionalId)
  if (filtros.status) query = query.where('status', '==', filtros.status)
  if (filtros.de) query = query.where('inicio', '>=', Timestamp.fromDate(filtros.de))
  if (filtros.ate) query = query.where('inicio', '<=', Timestamp.fromDate(filtros.ate))

  const snapshot = await query.get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Agendamento))
}

export async function atualizarAgendamento(contaId: string, agendamentoId: string, data: Partial<Omit<Agendamento, 'id' | 'dataCriacao'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('agendamentos').doc(agendamentoId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
}

/** Agendamentos criados depois de um instante — usado pelo polling em tempo real do painel. */
export async function listarAgendamentosRecentes(contaId: string, sinceMs: number, limit = 20): Promise<Agendamento[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('agendamentos')
    .where('dataCriacao', '>', Timestamp.fromMillis(sinceMs))
    .orderBy('dataCriacao', 'asc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Agendamento))
}

// ─────────────────────────────────────────
// CONVERSAS
// ─────────────────────────────────────────
// Estado de controle por número de telefone — principalmente se a IA está
// respondendo automaticamente ou se um atendente humano assumiu a conversa.
// Doc ID é o número sanitizado (só dígitos), pra bater com o `from`/`to` das mensagens.

function sanitizarNumero(numero: string): string {
  return numero.replace(/\D/g, '')
}

export async function obterConversa(contaId: string, numero: string): Promise<Conversa | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).get()
    if (!docSnap.exists) return null
    return { numero: sanitizarNumero(numero), ...convertTimestamps(docSnap.data()!) } as Conversa
  } catch {
    return null
  }
}

export async function definirIaAtivaConversa(
  contaId: string,
  numero: string,
  iaAtiva: boolean,
  motivoTransferencia?: string,
  origemTransferencia: 'ia' | 'manual' = 'manual',
): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    {
      numero: sanitizarNumero(numero),
      iaAtiva,
      ...(iaAtiva
        ? { motivoTransferencia: null, dataTransferencia: null, origemTransferencia: null }
        : { motivoTransferencia: motivoTransferencia ?? null, dataTransferencia: Timestamp.now(), origemTransferencia }),
    },
    { merge: true },
  )
}

/**
 * Conversas transferidas pra humano PELA IA depois de um instante — usado
 * pelo polling em tempo real do painel. Filtra 'ia' em memória (não no
 * Firestore) pra não precisar de índice composto: o range fica só em
 * dataTransferencia, que já tem índice de campo único automático.
 */
export async function listarTransferenciasRecentes(contaId: string, sinceMs: number, limit = 20): Promise<Conversa[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('conversas')
    .where('dataTransferencia', '>', Timestamp.fromMillis(sinceMs))
    .orderBy('dataTransferencia', 'asc')
    .limit(limit)
    .get()
  return snapshot.docs
    .map((doc) => ({ numero: doc.id, ...convertTimestamps(doc.data()) } as Conversa))
    .filter((c) => c.origemTransferencia === 'ia')
}

// ─────────────────────────────────────────
// MENSAGENS
// ─────────────────────────────────────────

/**
 * Cria uma mensagem no Firebase (global, não por conta)
 */
export async function criarMensagem(data: Omit<Mensagem, 'dataCriacao'>): Promise<Mensagem> {
  const db = getDb()
  const now = Timestamp.now()

  try {
    // Usa o ID do WhatsApp como document ID para evitar duplicatas
    await db.collection('mensagens').doc(data.id).set({
      ...data,
      dataCriacao: now,
    })
    
    console.log('✅ Mensagem salva com sucesso:', data.id)
    
    return { ...data, dataCriacao: now.toDate() }
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('❌ Erro ao salvar mensagem:', {
      code: err.code,
      message: err.message,
      id: data.id
    })
    throw error
  }
}

/**
 * Busca mensagens de uma conta específica
 */
export async function listarMensagens(contaId: string, limit = 100): Promise<Mensagem[]> {
  const db = getDb()
  const snapshot = await db.collection('mensagens')
    .where('contaId', '==', contaId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
  
  return snapshot.docs.map(doc => ({ ...doc.data() } as Mensagem))
}

/**
 * Busca mensagens de uma conta específica por número de telefone
 */
export async function listarMensagensPorNumero(contaId: string, numeroTelefone: string, limit = 100): Promise<Mensagem[]> {
  const db = getDb()
  // Mensagens recebidas gravam `from` = número do cliente; mensagens
  // enviadas pelo bot gravam `from` = phoneNumberId do negócio e
  // `to` = número do cliente. Filtrar só por `from` deixava de fora todas
  // as respostas do próprio bot — o histórico da conversa (usado pela IA)
  // ficava sempre incompleto, só com o lado do cliente.
  const snapshot = await db.collection('mensagens')
    .where('contaId', '==', contaId)
    .where(Filter.or(
      Filter.where('from', '==', numeroTelefone),
      Filter.where('to', '==', numeroTelefone)
    ))
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()

  return snapshot.docs.map(doc => ({ ...doc.data() } as Mensagem))
}

/**
 * Mensagens recebidas depois de um instante — usado pelo polling em tempo
 * real do painel. Reaproveita o mesmo índice de listarMensagens (contaId ==,
 * orderBy timestamp) e filtra em memória, evitando precisar de um índice
 * composto novo no Firestore. `limit` baixo de propósito: essa função lê
 * até `limit` mensagens do Firestore EM TODO poll, mesmo quando não há
 * nada novo (o filtro por `since` é em memória, não na query) — um limit
 * alto aqui multiplicado pela cadência do polling foi o que estourou a
 * cota gratuita do Firestore em produção.
 */
export async function listarMensagensRecebidasDesde(contaId: string, sinceMs: number, limit = 15): Promise<Mensagem[]> {
  const recentes = await listarMensagens(contaId, limit)
  return recentes
    .filter((m) => m.tipo === 'recebida' && (m.dataCriacao as unknown as Timestamp).toMillis() > sinceMs)
    .sort((a, b) => (a.dataCriacao as unknown as Timestamp).toMillis() - (b.dataCriacao as unknown as Timestamp).toMillis())
}

/**
 * Atualiza status de uma mensagem enviada
 */
export async function atualizarStatusMensagem(mensagemId: string, status: Mensagem['status']): Promise<void> {
  const db = getDb()
  
  console.log('📝 Atualizando status da mensagem:', { mensagemId, status })
  
  try {
    await db.collection('mensagens').doc(mensagemId).update({
      status,
    })
    
    console.log('✅ Status atualizado:', mensagemId)
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string }
    console.error('❌ Erro ao atualizar status:', {
      code: err.code,
      message: err.message,
      id: mensagemId
    })
    throw error
  }
}

