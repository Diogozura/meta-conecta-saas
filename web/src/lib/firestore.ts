/**
 * Serviços para interação com Firebase Firestore
 * Use em Server Components ou Server Actions apenas
 */

import { getFirestore, Timestamp, Query, Filter, FieldValue } from 'firebase-admin/firestore'
import { getApps } from 'firebase-admin/app'
import { Conta, ContaAiConfig, Usuario, MetaAccess, InstagramAccess, ContaVinculada, Cliente, Mensagem, MensagemInstagram, ComentarioInstagram, MencaoInstagram, PublicacaoInstagram, Profissional, Servico, Disponibilidade, Agendamento, Conversa, ConversaStatus, Fluxo, FLUXO_SAIU, EventoAtendimento, RespostaRapida, AvaliacaoCsat, RegistroAuditoria, Ticket } from '@/types/database'
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

// Converte campos Timestamp do Firestore Admin em Date antes de devolver ao
// front, caso contrário `new Date(timestamp)` no cliente vira "Invalid Date"
// (e cálculos com essa data viram NaN, ex: "há NaN dia"). Antes checava só
// uma lista fixa de nomes de campo (dataCadastro/dataAtualizacao/etc) — toda
// vez que um campo Date novo era adicionado a algum tipo (dataTransferencia,
// assumidoEm, criadoEm de eventos/avaliações, ...) e esquecido dessa lista,
// o bug voltava. Agora converte QUALQUER campo de primeiro nível que pareça
// um Timestamp (tem `.toDate()`), sem depender do nome.
function convertTimestamps<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = { ...data }
  for (const key of Object.keys(result)) {
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

/** Todas as contas ativas — usado só pela varredura do cron de alertas de SLA (não expor num endpoint comum, é dado de outras empresas). */
export async function listarContasAtivas(): Promise<Conta[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').where('status', '==', 'ativo').get()
  return snapshot.docs.map((doc) => decryptContaAiSecrets({ id: doc.id, ...convertTimestamps(doc.data()) } as Conta))
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

/**
 * Contador próprio de uso do agente de IA — não é a cota oficial do provedor
 * (Gemini/OpenAI/Anthropic não expõem isso via chave de API comum), mas dá um
 * número prático pra comparar com o limite conhecido do plano e diagnosticar
 * quando o agente parar de responder por causa de limite atingido.
 * Um doc por dia em contas/{contaId}/usoAgenteIA/{YYYY-MM-DD}.
 */
export async function registrarUsoAgenteIA(contaId: string): Promise<void> {
  const db = getDb()
  const hoje = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  await db
    .collection('contas')
    .doc(contaId)
    .collection('usoAgenteIA')
    .doc(hoje)
    .set({ total: FieldValue.increment(1), atualizadoEm: new Date().toISOString() }, { merge: true })
}

/** Uso do agente por dia, num intervalo [deChaveISO, ateChaveISO] (formato YYYY-MM-DD, inclusive). */
export async function obterUsoAgenteIA(contaId: string, deChave: string, ateChave: string): Promise<{ data: string; total: number }[]> {
  const db = getDb()
  const snap = await db
    .collection('contas')
    .doc(contaId)
    .collection('usoAgenteIA')
    .where('__name__', '>=', deChave)
    .where('__name__', '<=', ateChave)
    .get()
  return snap.docs.map((doc) => ({ data: doc.id, total: (doc.data().total as number) ?? 0 }))
}

// ─────────────────────────────────────────
// USUÁRIOS
// ─────────────────────────────────────────

// totpSecret (segredo do 2FA) é criptografado antes de gravar e
// descriptografado só na leitura — mesmo padrão do businessToken da Meta.
function encryptUsuarioSecrets<T extends { totpSecret?: string }>(data: T): T {
  if (!data.totpSecret) return data
  return { ...data, totpSecret: encrypt(data.totpSecret) }
}

function decryptUsuarioSecrets(usuario: Usuario): Usuario {
  if (!usuario.totpSecret) return usuario
  return { ...usuario, totpSecret: decrypt(usuario.totpSecret) }
}

export async function criarUsuario(contaId: string, data: Omit<Usuario, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Usuario> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('usuarios').add({
    ...encryptUsuarioSecrets(data),
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
    return decryptUsuarioSecrets({ id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Usuario)
  } catch {
    return null
  }
}

/** Todos os atendentes da conta, SEM o totpSecret (mesmo criptografado, não tem por que sair do servidor) — use obterUsuario quando precisar do segredo pra validar um código. */
export async function listarUsuarios(contaId: string): Promise<Usuario[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('usuarios').get()
  return snapshot.docs.map((doc) => {
    const dados = convertTimestamps(doc.data()) as Record<string, unknown>
    delete dados.totpSecret
    return { id: doc.id, ...dados } as Usuario
  })
}

export async function atualizarUsuario(contaId: string, usuarioId: string, data: Partial<Omit<Usuario, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('usuarios').doc(usuarioId).update({
    ...encryptUsuarioSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

/** Desativa o 2FA e limpa o segredo — não deixa lixo criptografado parado no banco depois de desligar. */
export async function desativarTotp(contaId: string, usuarioId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('usuarios').doc(usuarioId).update({
    totpAtivo: false,
    totpSecret: FieldValue.delete(),
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

/** Registra mais um número (mesma WABA/token) na conta — o Cloud API já deve ter sido chamado pra registrar o número antes (ver lib/meta.ts registerPhoneNumber). */
export async function adicionarNumeroWhatsapp(contaId: string, accessId: string, numero: { phoneNumberId: string; nome: string }): Promise<MetaAccess> {
  const db = getDb()
  const ref = db.collection('contas').doc(contaId).collection('metaAccess').doc(accessId)
  const atual = await ref.get()
  if (!atual.exists) throw new Error('Credenciais da Meta não encontradas')
  const existentes: { phoneNumberId: string; nome: string }[] = atual.data()?.numerosAdicionais ?? []
  const numerosAdicionais = [...existentes.filter((n) => n.phoneNumberId !== numero.phoneNumberId), numero]
  await ref.update({ numerosAdicionais, dataAtualizacao: Timestamp.now() })
  return decryptMetaAccessSecrets({ id: ref.id, ...convertTimestamps({ ...atual.data(), numerosAdicionais }) } as MetaAccess)
}

export async function removerNumeroWhatsapp(contaId: string, accessId: string, phoneNumberId: string): Promise<void> {
  const db = getDb()
  const ref = db.collection('contas').doc(contaId).collection('metaAccess').doc(accessId)
  const atual = await ref.get()
  if (!atual.exists) return
  const existentes: { phoneNumberId: string; nome: string }[] = atual.data()?.numerosAdicionais ?? []
  await ref.update({ numerosAdicionais: existentes.filter((n) => n.phoneNumberId !== phoneNumberId), dataAtualizacao: Timestamp.now() })
}

/** Guarda por qual número da conta (principal ou adicional) essa conversa está passando — best-effort, chamado a cada mensagem recebida com metadata.phone_number_id. */
export async function definirCanalConversa(contaId: string, numero: string, phoneNumberId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), canalPhoneNumberId: phoneNumberId },
    { merge: true },
  )
}

export async function atualizarMetaAccess(contaId: string, accessId: string, data: Partial<Omit<MetaAccess, 'id'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('metaAccess').doc(accessId).update({
    ...encryptMetaAccessSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

// ─────────────────────────────────────────
// INSTAGRAM ACCESS — mesmo padrão do MetaAccess (accessToken sempre
// criptografado antes de gravar, descriptografado só na leitura).
// ─────────────────────────────────────────

function encryptInstagramSecrets<T extends { accessToken?: string }>(data: T): T {
  return { ...data, ...(data.accessToken ? { accessToken: encrypt(data.accessToken) } : {}) }
}

function decryptInstagramSecrets(data: InstagramAccess): InstagramAccess {
  return { ...data, accessToken: data.accessToken ? decrypt(data.accessToken) : data.accessToken }
}

export async function criarInstagramAccess(contaId: string, data: Omit<InstagramAccess, 'id' | 'dataAtualizacao'>): Promise<InstagramAccess> {
  const db = getDb()
  const docRef = await db.collection('contas').doc(contaId).collection('instagramAccess').add({
    ...encryptInstagramSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
  return { id: docRef.id, ...data, dataAtualizacao: new Date() }
}

export async function obterInstagramAccess(contaId: string): Promise<InstagramAccess | null> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('instagramAccess').limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return decryptInstagramSecrets({ id: doc.id, ...convertTimestamps(doc.data()) } as InstagramAccess)
}

export async function atualizarInstagramAccess(contaId: string, accessId: string, data: Partial<Omit<InstagramAccess, 'id'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('instagramAccess').doc(accessId).update({
    ...encryptInstagramSecrets(data),
    dataAtualizacao: Timestamp.now(),
  })
}

export async function excluirInstagramAccess(contaId: string, accessId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('instagramAccess').doc(accessId).delete()
}

/** Busca InstagramAccess pelo ID da conta no Instagram (usado no webhook). */
export async function obterInstagramAccessPorIgUserId(igUserId: string): Promise<{ instagramAccess: InstagramAccess; contaId: string } | null> {
  const db = getDb()
  try {
    const rapida = await db.collectionGroup('instagramAccess').where('igUserId', '==', igUserId).limit(1).get()
    if (!rapida.empty) {
      const doc = rapida.docs[0]
      const contaId = doc.ref.parent.parent?.id
      if (contaId) {
        return { instagramAccess: decryptInstagramSecrets({ id: doc.id, ...doc.data() } as InstagramAccess), contaId }
      }
    }
    return null
  } catch (error) {
    console.warn('collectionGroup em instagramAccess falhou (provavelmente falta criar o índice — veja o link no erro):', error)
    return null
  }
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

/**
 * Acha o Cliente cadastrado pra um número de WhatsApp — usado pra detectar
 * automaticamente cliente VIP (tag) e priorizar a conversa na fila. Sem
 * índice dedicado: compara o número sanitizado em memória, igual ao que
 * `Conversa.numero` já usa — evita depender de como o telefone foi digitado
 * na hora do cadastro (com/sem DDI, espaços, etc.).
 */
export async function buscarClientePorNumero(contaId: string, numero: string): Promise<Cliente | null> {
  const alvo = sanitizarNumero(numero)
  if (!alvo) return null
  const clientes = await listarClientes(contaId)
  return clientes.find((c) => sanitizarNumero(c.whatsapp || c.telefone || '') === alvo) ?? null
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
  } catch (error) {
    console.error('Erro ao buscar profissional:', error)
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
  } catch (error) {
    console.error('Erro ao buscar serviço:', error)
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

/** Cria vários blocos de disponibilidade numa única escrita em lote (ex: "repetir por N semanas") — atômico, sem N idas sequenciais ao banco. Para um único bloco, passe um array de 1 item. */
export async function criarDisponibilidadesEmLote(contaId: string, items: Omit<Disponibilidade, 'id' | 'dataCadastro'>[]): Promise<Disponibilidade[]> {
  const db = getDb()
  const colRef = db.collection('contas').doc(contaId).collection('disponibilidades')
  const now = Timestamp.now()
  const batch = db.batch()

  const criados = items.map((data) => {
    const docRef = colRef.doc()
    batch.set(docRef, {
      ...data,
      inicio: Timestamp.fromDate(data.inicio),
      fim: Timestamp.fromDate(data.fim),
      dataCadastro: now,
    })
    return { id: docRef.id, ...data, dataCadastro: now.toDate() }
  })

  await batch.commit()
  return criados
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
  } catch (error) {
    console.error('Erro ao buscar disponibilidade:', error)
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

export class AgendamentoConflitoError extends Error {
  constructor(message = 'Esse horário acabou de ser reservado. Escolha outro.') {
    super(message)
  }
}

/** Verifica (fora de transação, best-effort) se já existe um agendamento confirmado do profissional que colide com o intervalo. */
export async function existeConflitoDeAgendamento(
  contaId: string,
  profissionalId: string,
  inicio: Date,
  fim: Date,
  ignorarId?: string,
): Promise<boolean> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('agendamentos')
    .where('profissionalId', '==', profissionalId)
    .where('status', '==', 'confirmado')
    .where('inicio', '<', Timestamp.fromDate(fim))
    .get()

  return snapshot.docs.some((doc) => {
    if (ignorarId && doc.id === ignorarId) return false
    const fimExistente = (doc.data().fim as Timestamp).toDate()
    return fimExistente > inicio
  })
}

/**
 * Cria um agendamento revalidando a ausência de conflito dentro da MESMA
 * transação do Firestore — ler e escrever em duas idas separadas ao banco
 * (padrão anterior) deixava uma janela onde duas requisições concorrentes
 * (ex: painel + agente de IA agendando ao mesmo tempo) podiam passar as
 * duas pela verificação e criar dois agendamentos sobrepostos.
 */
export async function criarAgendamentoSeLivre(
  contaId: string,
  data: Omit<Agendamento, 'id' | 'dataCriacao' | 'dataAtualizacao'>,
): Promise<Agendamento> {
  const db = getDb()
  const colRef = db.collection('contas').doc(contaId).collection('agendamentos')
  const inicioTs = Timestamp.fromDate(data.inicio)
  const fimTs = Timestamp.fromDate(data.fim)

  return db.runTransaction(async (tx) => {
    const conflitantesSnap = await tx.get(
      colRef
        .where('profissionalId', '==', data.profissionalId)
        .where('status', '==', 'confirmado')
        .where('inicio', '<', fimTs)
    )
    const temConflito = conflitantesSnap.docs.some((doc) => {
      const fimExistente = (doc.data().fim as Timestamp).toDate()
      return fimExistente > data.inicio
    })
    if (temConflito) throw new AgendamentoConflitoError()

    const now = Timestamp.now()
    const docRef = colRef.doc()
    tx.set(docRef, {
      ...data,
      inicio: inicioTs,
      fim: fimTs,
      dataCriacao: now,
      dataAtualizacao: now,
    })
    return { id: docRef.id, ...data, dataCriacao: now.toDate(), dataAtualizacao: now.toDate() }
  })
}

export async function obterAgendamento(contaId: string, agendamentoId: string): Promise<Agendamento | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('agendamentos').doc(agendamentoId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Agendamento
  } catch (error) {
    console.error('Erro ao buscar agendamento:', error)
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
        // Reativar a IA também libera o atendente — se ninguém mais está "na
        // trave", não faz sentido a conversa continuar marcada como atendida
        // por uma pessoa específica.
        ? { motivoTransferencia: null, dataTransferencia: null, origemTransferencia: null, atendenteId: null, atendenteNome: null, assumidoEm: null, alertaSlaEnviadoEm: null }
        : { motivoTransferencia: motivoTransferencia ?? null, dataTransferencia: Timestamp.now(), origemTransferencia, alertaSlaEnviadoEm: null }),
    },
    { merge: true },
  )
}

/**
 * Garante que existe um doc de conversa em status utilizável ao chegar
 * mensagem nova — cria com status 'aberta' se nunca existiu, ou reabre
 * ('aberta') se estava 'encerrada'. Idempotente e barato pra chamar em toda
 * mensagem recebida: não sobrescreve nada se a conversa já está
 * aberta/em_andamento.
 */
export async function garantirConversaAberta(contaId: string, numero: string): Promise<void> {
  const db = getDb()
  const ref = db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero))
  const snap = await ref.get()
  if (!snap.exists) {
    await ref.set({ numero: sanitizarNumero(numero), status: 'aberta', abertaEm: Timestamp.now(), iaAtiva: true }, { merge: true })
    await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'aberta' }).catch(() => {})
    return
  }
  const status = (snap.data()?.status as ConversaStatus | undefined) ?? 'em_andamento'
  if (status === 'encerrada') {
    // Reabrir é um contato novo pro fluxo de atendimento também — sem isso,
    // uma conversa que já tinha saído do fluxo (ex: foi pra IA) continuaria
    // "saída" mesmo depois de reaberta, pulando o menu pra sempre.
    await ref.set({ status: 'aberta', abertaEm: Timestamp.now(), encerradaEm: null, encerradaPor: null, fluxoNoAtualId: null }, { merge: true })
    await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'aberta' }).catch(() => {})
  }
}

/** Chamado depois de qualquer resposta enviada (IA ou manual) — uma conversa recém-aberta passa a "em andamento". */
export async function marcarConversaEmAndamento(contaId: string, numero: string): Promise<void> {
  const db = getDb()
  const ref = db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero))
  await ref.set({ numero: sanitizarNumero(numero), status: 'em_andamento' }, { merge: true })
}

export async function encerrarConversa(contaId: string, numero: string, encerradaPor: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), status: 'encerrada', encerradaEm: Timestamp.now(), encerradaPor },
    { merge: true },
  )
  await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'encerrada' }).catch(() => {})
}

// ─────────────────────────────────────────
// CSAT (Subcoleção: contas/{contaId}/avaliacoesCsat) — nota 0-10 que o
// cliente dá ao responder a pergunta de satisfação enviada ao encerrar uma
// conversa. Ver lib/csatService.ts pro envio/interpretação da resposta.
// ─────────────────────────────────────────

export async function marcarAguardandoCsat(contaId: string, numero: string, aguardando: boolean): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), aguardandoCsat: aguardando },
    { merge: true },
  )
}

export async function salvarAvaliacaoCsat(contaId: string, numero: string, nota: number): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('avaliacoesCsat').add({
    numero: sanitizarNumero(numero),
    nota,
    criadoEm: Timestamp.now(),
  })
}

export async function listarAvaliacoesCsat(contaId: string, desde: Date): Promise<AvaliacaoCsat[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('avaliacoesCsat')
    .where('criadoEm', '>=', Timestamp.fromDate(desde))
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as AvaliacaoCsat))
}

export async function reabrirConversa(contaId: string, numero: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), status: 'aberta', encerradaEm: null, encerradaPor: null },
    { merge: true },
  )
}

/** Atendente reivindica a conversa explicitamente — distinto de só desativar a IA (mesmo efeito sobre iaAtiva, mas registra quem assumiu). */
export async function assumirConversa(contaId: string, numero: string, atendenteId: string, atendenteNome: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    {
      numero: sanitizarNumero(numero),
      iaAtiva: false,
      atendenteId,
      atendenteNome,
      assumidoEm: Timestamp.now(),
      // A espera acabou — se essa conversa voltar pra fila depois, um novo
      // alerta de SLA deve poder disparar de novo.
      alertaSlaEnviadoEm: null,
    },
    { merge: true },
  )
  await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'assumida', atendenteId, atendenteNome }).catch(() => {})
}

/** Libera a reivindicação sem reativar a IA — conversa volta pra fila "aguardando humano" sem dono. */
export async function liberarAtendenteConversa(contaId: string, numero: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), atendenteId: null, atendenteNome: null, assumidoEm: null },
    { merge: true },
  )
  await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'liberada' }).catch(() => {})
}

/** Resumo de todas as conversas da conta — usado pra sobrepor status/fila na lista do painel. Uma conta tem no máximo algumas centenas de números ativos, então uma leitura direta (sem paginação) é suficiente aqui. */
export async function listarConversas(contaId: string): Promise<Conversa[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('conversas').get()
  return snapshot.docs.map((doc) => ({ numero: doc.id, ...convertTimestamps(doc.data()) } as Conversa))
}

/** Guarda em que nó do Fluxo a conversa está parada (aguardando resposta do cliente) — null quando o fluxo terminou/não está em uso. */
/** `fluxoAtualId` é o fluxo (documento) que essa conversa está progredindo — null = o fluxo ATIVO da conta (comportamento de sempre); só é diferente depois de um nó "ir_para_fluxo". */
export async function atualizarFluxoConversa(contaId: string, numero: string, noAtualId: string | null, fluxoAtualId: string | null = null): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), fluxoNoAtualId: noAtualId, fluxoAtualId },
    { merge: true },
  )
}

/** Encaminha a conversa pra fila humana a partir do Fluxo — mesmo efeito de um handoff da IA, mais o setor (se o nó do fluxo definiu um). Tenta round-robin entre atendentes desse setor antes de deixar "aguardando" sem dono. */
export async function encaminharConversaParaFilaPeloFluxo(contaId: string, numero: string, setor?: string, motivo?: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    {
      numero: sanitizarNumero(numero),
      iaAtiva: false,
      fluxoNoAtualId: FLUXO_SAIU,
      fluxoAtualId: null,
      setor: setor ?? null,
      motivoTransferencia: motivo ?? (setor ? `Encaminhado pelo fluxo para ${setor}` : 'Encaminhado pelo fluxo de atendimento'),
      dataTransferencia: Timestamp.now(),
      origemTransferencia: 'ia',
      alertaSlaEnviadoEm: null,
    },
    { merge: true },
  )
  await registrarEventoAtendimento(contaId, { numero: sanitizarNumero(numero), tipo: 'transferida_humano', setor: setor ?? null }).catch(() => {})

  if (setor) {
    const atendente = await atribuirRoundRobin(contaId, setor).catch(() => null)
    if (atendente) await assumirConversa(contaId, numero, atendente.id, atendente.nome)
  }
}

/** Guarda a resposta de um nó "coleta" do Fluxo em Conversa.dadosColetados[variavel] — merge recursivo, não apaga chaves coletadas antes. */
export async function salvarDadoColetado(contaId: string, numero: string, variavel: string, valor: string): Promise<void> {
  if (!variavel.trim()) return
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), dadosColetados: { [variavel.trim()]: valor } },
    { merge: true },
  )
}

export async function definirPrioridadeConversa(contaId: string, numero: string, prioridade: 'normal' | 'alta' | 'urgente'): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), prioridade },
    { merge: true },
  )
}

/** Adiciona uma etiqueta à conversa (nó "adicionar_etiqueta" do fluxo) — sem duplicar se já tiver essa mesma etiqueta. */
export async function adicionarEtiquetaConversa(contaId: string, numero: string, etiqueta: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), etiquetas: FieldValue.arrayUnion(etiqueta) },
    { merge: true },
  )
}

/** Salva o protocolo gerado por um nó "gerar_protocolo" do fluxo. */
export async function definirProtocoloConversa(contaId: string, numero: string, protocolo: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), protocolo },
    { merge: true },
  )
}

/** Move a conversa pra outra coluna do Kanban do CRM leve — por um nó "mover_etapa_funil" do fluxo, ou arrastada manualmente no board. */
export async function moverConversaEtapaFunil(contaId: string, numero: string, etapaFunilId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), etapaFunilId },
    { merge: true },
  )
}

/** Marca que o alerta de SLA já foi enviado pra essa espera — evita o cron reenviar e-mail a cada execução enquanto a conversa continuar parada. */
export async function marcarAlertaSlaEnviado(contaId: string, numero: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('conversas').doc(sanitizarNumero(numero)).set(
    { numero: sanitizarNumero(numero), alertaSlaEnviadoEm: Timestamp.now() },
    { merge: true },
  )
}

// ─────────────────────────────────────────
// EVENTOS DE ATENDIMENTO (Subcoleção: contas/{contaId}/eventosAtendimento)
// Log append-only de transições — só alimenta métricas HISTÓRICAS; o estado
// "ao vivo" de cada conversa continua sendo Conversa, não isso aqui.
// ─────────────────────────────────────────

export async function registrarEventoAtendimento(contaId: string, data: Omit<EventoAtendimento, 'id' | 'criadoEm'>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('eventosAtendimento').add({
    ...data,
    criadoEm: Timestamp.now(),
  })
}

/** Eventos desde um instante — base das métricas históricas (ex: "últimos 7 dias"). */
export async function listarEventosAtendimento(contaId: string, desde: Date): Promise<EventoAtendimento[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('eventosAtendimento')
    .where('criadoEm', '>=', Timestamp.fromDate(desde))
    .orderBy('criadoEm', 'asc')
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as EventoAtendimento))
}

// ─────────────────────────────────────────
// ROUND-ROBIN de atendentes por setor
// ─────────────────────────────────────────

/**
 * Escolhe o próximo atendente ativo de um setor, em rodízio — cada setor
 * mantém seu próprio "ponteiro" (contas/{contaId}/roundRobin/{setor}). A
 * lista de elegíveis é lida fora da transação (Firestore não faz query
 * arbitrária dentro de uma transação de forma barata aqui) — numa correria
 * de várias conversas chegando ao mesmo tempo pro mesmo setor, o pior caso é
 * escalar alguém com base numa lista de elegíveis levemente desatualizada,
 * nunca perder o avanço do ponteiro em si (isso sim fica dentro da transação).
 * Retorna null se ninguém do setor está marcado como atendente ativo — nesse
 * caso a conversa fica na fila geral, sem dono, pra alguém assumir manualmente.
 */
export async function atribuirRoundRobin(contaId: string, setor: string): Promise<Usuario | null> {
  const setorNormalizado = setor.trim().toLowerCase()
  if (!setorNormalizado) return null

  const usuarios = await listarUsuarios(contaId)
  const elegiveis = usuarios
    .filter((u) => u.status === 'ativo' && (u.setor ?? '').trim().toLowerCase() === setorNormalizado)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (elegiveis.length === 0) return null

  const db = getDb()
  const cursorRef = db.collection('contas').doc(contaId).collection('roundRobin').doc(setorNormalizado.replace(/\s+/g, '-'))

  return db.runTransaction(async (tx) => {
    const cursorSnap = await tx.get(cursorRef)
    const ultimoId = cursorSnap.exists ? (cursorSnap.data()?.ultimoAtendenteId as string | undefined) : undefined
    const idxAtual = ultimoId ? elegiveis.findIndex((u) => u.id === ultimoId) : -1
    const proximo = elegiveis[(idxAtual + 1) % elegiveis.length]
    tx.set(cursorRef, { ultimoAtendenteId: proximo.id, atualizadoEm: Timestamp.now() }, { merge: true })
    return proximo
  })
}

// ─────────────────────────────────────────
// RESPOSTAS RÁPIDAS (Subcoleção: contas/{contaId}/respostasRapidas)
// ─────────────────────────────────────────

export async function criarRespostaRapida(contaId: string, data: Omit<RespostaRapida, 'id' | 'contaId' | 'dataCadastro'>): Promise<RespostaRapida> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('respostasRapidas').add({ contaId, ...data, dataCadastro: now })
  return { id: docRef.id, contaId, ...data, dataCadastro: now.toDate() }
}

export async function listarRespostasRapidas(contaId: string): Promise<RespostaRapida[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('respostasRapidas').orderBy('atalho', 'asc').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as RespostaRapida))
}

export async function atualizarRespostaRapida(contaId: string, id: string, data: Partial<Pick<RespostaRapida, 'atalho' | 'texto'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('respostasRapidas').doc(id).update(data)
}

export async function excluirRespostaRapida(contaId: string, id: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('respostasRapidas').doc(id).delete()
}

// ─────────────────────────────────────────
// FLUXO (Subcoleção: contas/{contaId}/fluxos) — uma conta pode manter vários
// fluxos desenhados (ex: "Padrão", "Black Friday", "Recesso de fim de ano"),
// mas no máximo 1 fica `ativo` por vez — é esse que o webhook usa.
// ─────────────────────────────────────────

export async function listarFluxos(contaId: string): Promise<Fluxo[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('fluxos').orderBy('dataAtualizacao', 'desc').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Fluxo))
}

export async function obterFluxoPorId(contaId: string, fluxoId: string): Promise<Fluxo | null> {
  const db = getDb()
  try {
    const docSnap = await db.collection('contas').doc(contaId).collection('fluxos').doc(fluxoId).get()
    if (!docSnap.exists) return null
    return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Fluxo
  } catch (error) {
    console.error('Erro ao buscar fluxo:', error)
    return null
  }
}

/** Fluxo ativo da conta, pronto pra uso no motor de execução — null quando nenhum está ligado. */
export async function obterFluxoAtivo(contaId: string): Promise<Fluxo | null> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('fluxos').where('ativo', '==', true).limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...convertTimestamps(doc.data()) } as Fluxo
}

/** Desliga `ativo` em todos os fluxos da conta (num batch) — garante que no máximo 1 fica ligado ao ativar/salvar outro como ativo. */
async function desativarOutrosFluxos(contaId: string, exceto?: string): Promise<void> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('fluxos').where('ativo', '==', true).get()
  const alvos = snapshot.docs.filter((doc) => doc.id !== exceto)
  if (alvos.length === 0) return
  const batch = db.batch()
  for (const doc of alvos) batch.update(doc.ref, { ativo: false })
  await batch.commit()
}

export async function criarFluxo(contaId: string, data: Pick<Fluxo, 'nome' | 'ativo' | 'nodes' | 'edges'>): Promise<Fluxo> {
  const db = getDb()
  if (data.ativo) await desativarOutrosFluxos(contaId)
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('fluxos').add({
    contaId,
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, contaId, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
}

export async function atualizarFluxo(contaId: string, fluxoId: string, data: Pick<Fluxo, 'nome' | 'ativo' | 'nodes' | 'edges'>): Promise<Fluxo> {
  const db = getDb()
  if (data.ativo) await desativarOutrosFluxos(contaId, fluxoId)
  const ref = db.collection('contas').doc(contaId).collection('fluxos').doc(fluxoId)
  const existente = await ref.get()
  const now = Timestamp.now()
  const dataCadastro = existente.exists ? (existente.data()!.dataCadastro as Timestamp) : now
  await ref.set({ contaId, ...data, dataCadastro, dataAtualizacao: now }, { merge: false })
  return { id: fluxoId, contaId, ...data, dataCadastro: dataCadastro.toDate(), dataAtualizacao: now.toDate() }
}

/** Ativa um fluxo específico e desliga qualquer outro que estivesse ativo — atalho pra "trocar de fluxo" sem reabrir o editor. */
export async function ativarFluxo(contaId: string, fluxoId: string): Promise<void> {
  const db = getDb()
  await desativarOutrosFluxos(contaId, fluxoId)
  await db.collection('contas').doc(contaId).collection('fluxos').doc(fluxoId).update({ ativo: true, dataAtualizacao: Timestamp.now() })
}

export async function excluirFluxo(contaId: string, fluxoId: string): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('fluxos').doc(fluxoId).delete()
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
// AUDITORIA (Subcoleção: contas/{contaId}/auditoria) — log append-only de
// mudanças em configurações sensíveis (fluxo, respostas rápidas, equipe).
// ─────────────────────────────────────────

export async function registrarAuditoria(contaId: string, data: Omit<RegistroAuditoria, 'id' | 'contaId' | 'criadoEm'>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('auditoria').add({
    contaId,
    ...data,
    criadoEm: Timestamp.now(),
  })
}

/** Últimos registros de auditoria da conta, mais recente primeiro. */
export async function listarAuditoria(contaId: string, limite = 200): Promise<RegistroAuditoria[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('auditoria')
    .orderBy('criadoEm', 'desc')
    .limit(limite)
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as RegistroAuditoria))
}

// ─────────────────────────────────────────
// LGPD — exportação e exclusão de todos os dados de um cliente (por número),
// a pedido do titular dos dados (Lei 13.709/2018, art. 18: portabilidade e
// eliminação). Ver api/conversas/[numero]/lgpd/{exportar,route}.
// ─────────────────────────────────────────

/** Todas as mensagens de um número, sem limite de página — só usado pra exportação/exclusão LGPD (o resto do app usa listarMensagensPorNumero, que já limita por ser consumido pela IA/painel). */
async function listarTodasMensagensPorNumero(contaId: string, numero: string): Promise<Mensagem[]> {
  const db = getDb()
  const snapshot = await db.collection('mensagens')
    .where('contaId', '==', contaId)
    .where(Filter.or(
      Filter.where('from', '==', numero),
      Filter.where('to', '==', numero)
    ))
    .get()
  return snapshot.docs.map((doc) => ({ ...doc.data() } as Mensagem))
}

export interface ExportacaoDadosCliente {
  numero: string
  cliente: Cliente | null
  conversa: Conversa | null
  mensagens: Mensagem[]
  avaliacoesCsat: AvaliacaoCsat[]
  exportadoEm: string
}

/** Reúne tudo que a conta guarda sobre um número — usado pro botão "Exportar dados (LGPD)" no painel. */
export async function exportarDadosCliente(contaId: string, numero: string): Promise<ExportacaoDadosCliente> {
  const numeroSanitizado = sanitizarNumero(numero)
  const db = getDb()
  const [cliente, conversa, mensagens, avaliacoesSnap] = await Promise.all([
    buscarClientePorNumero(contaId, numeroSanitizado),
    obterConversa(contaId, numeroSanitizado),
    listarTodasMensagensPorNumero(contaId, numeroSanitizado),
    db.collection('contas').doc(contaId).collection('avaliacoesCsat').where('numero', '==', numeroSanitizado).get(),
  ])
  const avaliacoesCsat = avaliacoesSnap.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as AvaliacaoCsat))
  return { numero: numeroSanitizado, cliente, conversa, mensagens, avaliacoesCsat, exportadoEm: new Date().toISOString() }
}

/** Apaga TODOS os dados de um cliente (mensagens, conversa, avaliações de CSAT, cadastro) — irreversível, a pedido do titular (LGPD). */
export async function excluirDadosCliente(contaId: string, numero: string): Promise<{ mensagensApagadas: number }> {
  const numeroSanitizado = sanitizarNumero(numero)
  const db = getDb()

  const [mensagensSnap, avaliacoesSnap] = await Promise.all([
    db.collection('mensagens')
      .where('contaId', '==', contaId)
      .where(Filter.or(
        Filter.where('from', '==', numeroSanitizado),
        Filter.where('to', '==', numeroSanitizado)
      ))
      .get(),
    db.collection('contas').doc(contaId).collection('avaliacoesCsat').where('numero', '==', numeroSanitizado).get(),
  ])

  const alvos = [...mensagensSnap.docs, ...avaliacoesSnap.docs]
  for (let i = 0; i < alvos.length; i += 400) {
    const batch = db.batch()
    for (const doc of alvos.slice(i, i + 400)) batch.delete(doc.ref)
    await batch.commit()
  }

  await db.collection('contas').doc(contaId).collection('conversas').doc(numeroSanitizado).delete().catch(() => {})

  const cliente = await buscarClientePorNumero(contaId, numeroSanitizado)
  if (cliente) {
    await db.collection('contas').doc(contaId).collection('clientes').doc(cliente.id).delete().catch(() => {})
  }

  return { mensagensApagadas: mensagensSnap.docs.length }
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
 * Mensagens ENVIADAS cujo status mudou pra "falhou" desde um instante —
 * usado pelo mesmo polling do painel pra avisar quando uma mensagem que
 * pareceu enviada (a Meta respondeu 200 OK na hora) na verdade não foi
 * entregue. A Meta só reporta esse tipo de falha depois, de forma
 * assíncrona, via webhook de status — nunca na resposta síncrona do envio.
 * Reaproveita `listarMensagens` (mesmo índice) igual a
 * listarMensagensRecebidasDesde, pelo mesmo motivo: evitar índice composto novo.
 */
export async function listarFalhasDesde(contaId: string, sinceMs: number, limit = 15): Promise<Mensagem[]> {
  const recentes = await listarMensagens(contaId, limit)
  return recentes.filter((m) => {
    if (m.tipo !== 'enviada' || m.status !== 'falhou' || !m.statusAtualizadoEm) return false
    return (m.statusAtualizadoEm as unknown as Timestamp).toMillis() > sinceMs
  })
}

// A Meta manda o status em inglês ('sent'/'delivered'/'read'/'failed') no
// webhook — o schema do Firestore usa os valores em português. Sem esse
// mapa, o `as Mensagem['status']` só fazia o TypeScript aceitar o cast, mas
// o Firestore acabava salvando 'failed' num campo que nada consultava como
// 'falhou', então nenhuma falha real de entrega era detectada.
const META_STATUS_MAP: Record<string, Mensagem['status']> = {
  sent: 'enviada',
  delivered: 'entregue',
  read: 'lida',
  failed: 'falhou',
}

/**
 * Atualiza status de uma mensagem enviada (chamado a partir do webhook de
 * status da Meta). `metaStatus` vem em inglês, direto do payload da Meta.
 */
export async function atualizarStatusMensagem(
  mensagemId: string,
  metaStatus: string,
  erro?: { codigo?: number; mensagem: string },
): Promise<void> {
  const db = getDb()
  const status = META_STATUS_MAP[metaStatus]
  if (!status) {
    console.warn('⚠️ Status desconhecido recebido da Meta, ignorando:', metaStatus)
    return
  }

  console.log('📝 Atualizando status da mensagem:', { mensagemId, status, erro })

  try {
    await db.collection('mensagens').doc(mensagemId).update({
      status,
      statusAtualizadoEm: Timestamp.now(),
      ...(erro ? { erro } : {}),
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

// ─────────────────────────────────────────
// MENSAGENS INSTAGRAM (DMs) — mesmo padrão de MENSAGENS (WhatsApp): coleção
// global, doc ID = ID da mensagem no Instagram (dedupe), filtro por `since`
// em memória pra evitar índice composto novo.
// ─────────────────────────────────────────

export async function criarMensagemInstagram(data: Omit<MensagemInstagram, 'dataCriacao'>): Promise<MensagemInstagram> {
  const db = getDb()
  const now = Timestamp.now()
  await db.collection('mensagensInstagram').doc(data.id).set({
    ...data,
    dataCriacao: now,
  })
  return { ...data, dataCriacao: now.toDate() }
}

export async function listarMensagensInstagram(contaId: string, limit = 100): Promise<MensagemInstagram[]> {
  const db = getDb()
  const snapshot = await db.collection('mensagensInstagram')
    .where('contaId', '==', contaId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => ({ ...doc.data() } as MensagemInstagram))
}

export async function listarMensagensInstagramPorConversa(contaId: string, conversationId: string, limit = 100): Promise<MensagemInstagram[]> {
  const db = getDb()
  const snapshot = await db.collection('mensagensInstagram')
    .where('contaId', '==', contaId)
    .where('conversationId', '==', conversationId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => ({ ...doc.data() } as MensagemInstagram))
}

/** Mensagens recebidas depois de um instante — usado pelo polling do painel (mesma lógica de listarMensagensRecebidasDesde). */
export async function listarMensagensInstagramRecebidasDesde(contaId: string, sinceMs: number, limit = 15): Promise<MensagemInstagram[]> {
  const recentes = await listarMensagensInstagram(contaId, limit)
  return recentes
    .filter((m) => m.tipo === 'recebida' && (m.dataCriacao as unknown as Timestamp).toMillis() > sinceMs)
    .sort((a, b) => (a.dataCriacao as unknown as Timestamp).toMillis() - (b.dataCriacao as unknown as Timestamp).toMillis())
}

// ─────────────────────────────────────────
// COMENTÁRIOS INSTAGRAM
// ─────────────────────────────────────────

export async function criarComentarioInstagram(data: Omit<ComentarioInstagram, 'dataCriacao'>): Promise<ComentarioInstagram> {
  const db = getDb()
  const now = Timestamp.now()
  await db.collection('comentariosInstagram').doc(data.id).set({
    ...data,
    dataCriacao: now,
  })
  return { ...data, dataCriacao: now.toDate() }
}

export async function listarComentariosPorMedia(contaId: string, mediaId: string): Promise<ComentarioInstagram[]> {
  const db = getDb()
  const snapshot = await db.collection('comentariosInstagram')
    .where('contaId', '==', contaId)
    .where('mediaId', '==', mediaId)
    .orderBy('timestamp', 'desc')
    .get()
  return snapshot.docs.map((doc) => ({ ...doc.data() } as ComentarioInstagram))
}

/**
 * Marca um comentário como respondido — usa `set` com merge (não `update`)
 * porque o comentário pode nunca ter sido persistido via webhook (ex:
 * comentário antigo, de antes da integração), então o doc pode não existir ainda.
 */
export async function marcarComentarioRespondido(contaId: string, mediaId: string, comentarioId: string): Promise<void> {
  const db = getDb()
  await db.collection('comentariosInstagram').doc(comentarioId).set(
    { contaId, mediaId, respondido: true },
    { merge: true },
  )
}

// ─────────────────────────────────────────
// MENÇÕES INSTAGRAM — só existem a partir do primeiro webhook recebido
// (a Graph API não permite buscar menções antigas).
// ─────────────────────────────────────────

export async function criarMencaoInstagram(data: Omit<MencaoInstagram, 'dataCriacao'>): Promise<MencaoInstagram> {
  const db = getDb()
  const now = Timestamp.now()
  await db.collection('mencoesInstagram').doc(data.id).set({
    ...data,
    dataCriacao: now,
  })
  return { ...data, dataCriacao: now.toDate() }
}

export async function listarMencoesRecentes(contaId: string, limit = 10): Promise<MencaoInstagram[]> {
  const db = getDb()
  const snapshot = await db.collection('mencoesInstagram')
    .where('contaId', '==', contaId)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => ({ ...doc.data() } as MencaoInstagram))
}

// ─────────────────────────────────────────
// PUBLICAÇÕES INSTAGRAM (Subcoleção: contas/{contaId}/publicacoesInstagram)
// ─────────────────────────────────────────

export async function criarPublicacaoInstagram(contaId: string, data: Omit<PublicacaoInstagram, 'id' | 'contaId' | 'dataCriacao'>): Promise<PublicacaoInstagram> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('publicacoesInstagram').add({
    ...data,
    contaId,
    dataCriacao: now,
  })
  return { id: docRef.id, contaId, ...data, dataCriacao: now.toDate() }
}

export async function atualizarPublicacaoInstagram(contaId: string, publicacaoId: string, data: Partial<Omit<PublicacaoInstagram, 'id' | 'contaId' | 'dataCriacao'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('publicacoesInstagram').doc(publicacaoId).update(data)
}

export async function obterPublicacaoInstagram(contaId: string, publicacaoId: string): Promise<PublicacaoInstagram | null> {
  const db = getDb()
  const docSnap = await db.collection('contas').doc(contaId).collection('publicacoesInstagram').doc(publicacaoId).get()
  if (!docSnap.exists) return null
  return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as PublicacaoInstagram
}

export async function listarPublicacoesInstagram(contaId: string, limit = 30): Promise<PublicacaoInstagram[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('publicacoesInstagram')
    .orderBy('dataCriacao', 'desc')
    .limit(limit)
    .get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as PublicacaoInstagram))
}

// ─────────────────────────────────────────
// TICKETS (Subcoleção: contas/{contaId}/tickets) — chamados de suporte/SAC,
// separados da Conversa (ver types/database.ts Ticket).
// ─────────────────────────────────────────

export async function criarTicket(contaId: string, data: Pick<Ticket, 'numero' | 'assunto' | 'descricao' | 'protocolo' | 'prioridade' | 'criadoPor'>): Promise<Ticket> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').doc(contaId).collection('tickets').add({
    ...data,
    status: 'aberto',
    criadoEm: now,
    atualizadoEm: now,
  })
  return { id: docRef.id, ...data, status: 'aberto', criadoEm: now.toDate(), atualizadoEm: now.toDate() }
}

/** Todos os tickets da conta — uma conta tem no máximo algumas centenas, então uma leitura direta (sem paginação) é suficiente aqui (mesmo raciocínio de listarConversas). */
export async function listarTickets(contaId: string): Promise<Ticket[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('tickets').orderBy('criadoEm', 'desc').get()
  return snapshot.docs.map((doc) => ({ id: doc.id, ...convertTimestamps(doc.data()) } as Ticket))
}

export async function obterTicket(contaId: string, ticketId: string): Promise<Ticket | null> {
  const db = getDb()
  const docSnap = await db.collection('contas').doc(contaId).collection('tickets').doc(ticketId).get()
  if (!docSnap.exists) return null
  return { id: docSnap.id, ...convertTimestamps(docSnap.data()!) } as Ticket
}

export async function atualizarTicket(
  contaId: string,
  ticketId: string,
  patch: Partial<Pick<Ticket, 'status' | 'prioridade' | 'descricao' | 'atendenteId' | 'atendenteNome'>>
): Promise<void> {
  const db = getDb()
  const update: Record<string, unknown> = { ...patch, atualizadoEm: Timestamp.now() }
  // resolvidoEm só é tocado quando o status faz parte dessa atualização —
  // uma troca de prioridade/atendente sozinha não deve mexer nele.
  if (patch.status === 'resolvido' || patch.status === 'fechado') {
    update.resolvidoEm = Timestamp.now()
  } else if (patch.status === 'aberto' || patch.status === 'em_andamento') {
    // Reaberto — não fica com uma data de resolução antiga "pendurada".
    update.resolvidoEm = null
  }
  await db.collection('contas').doc(contaId).collection('tickets').doc(ticketId).update(update)
}

