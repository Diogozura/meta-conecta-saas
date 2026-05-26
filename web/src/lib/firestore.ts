/**
 * Serviços para interação com Firebase Firestore
 * Use em Server Components ou Server Actions apenas
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Conta, Usuario, MetaAccess, ContaVinculada, Cliente, Mensagem } from '@/types/database'

// Garante que apenas uma instância do Firestore é inicializada
// Firebase Admin já foi inicializado em lib/firebase-admin.ts
function getDb() {
  const { getApps } = require('firebase-admin/app')
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

// ─────────────────────────────────────────
// CONTAS
// ─────────────────────────────────────────

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
  } catch (error: any) {
    console.error('❌ Erro detalhado ao criar conta:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    })
    throw error
  }
}

export async function obterConta(contaId: string): Promise<Conta | null> {
  const db = getDb()
  const docSnap = await db.collection('contas').doc(contaId).get()
  if (!docSnap.exists) return null
  return { id: docSnap.id, ...docSnap.data() } as Conta
}

export async function atualizarConta(contaId: string, data: Partial<Omit<Conta, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
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
    return { id: docSnap.id, ...docSnap.data() } as Usuario
  } catch {
    return null
  }
}

export async function listarUsuarios(contaId: string): Promise<Usuario[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('usuarios').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Usuario))
}

export async function atualizarUsuario(contaId: string, usuarioId: string, data: Partial<Omit<Usuario, 'id' | 'dataCadastro'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('usuarios').doc(usuarioId).update({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
}

// ─────────────────────────────────────────
// META ACCESS
// ─────────────────────────────────────────

export async function criarMetaAccess(contaId: string, data: Omit<MetaAccess, 'id' | 'dataAtualizacao'>): Promise<MetaAccess> {
  const db = getDb()
  const docRef = await db.collection('contas').doc(contaId).collection('metaAccess').add({
    ...data,
    dataAtualizacao: Timestamp.now(),
  })
  return { id: docRef.id, ...data, dataAtualizacao: new Date() }
}

export async function obterMetaAccess(contaId: string): Promise<MetaAccess | null> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('metaAccess').limit(1).get()
  if (snapshot.empty) return null
  const doc = snapshot.docs[0]
  return { id: doc.id, ...doc.data() } as MetaAccess
}

/**
 * Busca MetaAccess por WABA ID (usado em webhooks)
 */
export async function obterMetaAccessPorWabaId(wabaId: string): Promise<{ metaAccess: MetaAccess; contaId: string } | null> {
  const db = getDb()
  
  console.log('🔍 Buscando conta pelo WABA ID:', wabaId)
  
  // Buscar em todas as contas
  const contasSnapshot = await db.collection('contas').get()
  
  console.log('📊 Total de contas:', contasSnapshot.size)
  
  for (const contaDoc of contasSnapshot.docs) {
    const metaSnapshot = await contaDoc.ref.collection('metaAccess')
      .where('wabaId', '==', wabaId)
      .limit(1)
      .get()
    
    console.log(`  Conta ${contaDoc.id}: ${metaSnapshot.size} metaAccess com WABA ${wabaId}`)
    
    if (!metaSnapshot.empty) {
      const metaDoc = metaSnapshot.docs[0]
      const metaData = metaDoc.data()
      console.log('✅ Encontrado! WABA:', metaData.wabaId, 'Conta:', contaDoc.id)
      return {
        metaAccess: { id: metaDoc.id, ...metaData } as MetaAccess,
        contaId: contaDoc.id
      }
    }
  }
  
  console.log('❌ Nenhuma conta encontrada com WABA:', wabaId)
  return null
}

export async function atualizarMetaAccess(contaId: string, accessId: string, data: Partial<Omit<MetaAccess, 'id'>>): Promise<void> {
  const db = getDb()
  await db.collection('contas').doc(contaId).collection('metaAccess').doc(accessId).update({
    ...data,
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
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ContaVinculada))
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
    return { id: docSnap.id, ...docSnap.data() } as Cliente
  } catch {
    return null
  }
}

export async function listarClientes(contaId: string): Promise<Cliente[]> {
  const db = getDb()
  const snapshot = await db.collection('contas').doc(contaId).collection('clientes').orderBy('dataCadastro', 'desc').get()
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Cliente))
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
// MENSAGENS
// ─────────────────────────────────────────

/**
 * Cria uma mensagem no Firebase (global, não por conta)
 */
export async function criarMensagem(data: Omit<Mensagem, 'dataCriacao'>): Promise<Mensagem> {
  const db = getDb()
  const now = Timestamp.now()
  
  console.log('📝 Salvando mensagem no Firebase:', {
    id: data.id,
    from: data.from,
    text: data.text?.substring(0, 50),
    contaId: data.contaId
  })
  
  try {
    // Usa o ID do WhatsApp como document ID para evitar duplicatas
    await db.collection('mensagens').doc(data.id).set({
      ...data,
      dataCriacao: now,
    })
    
    console.log('✅ Mensagem salva com sucesso:', data.id)
    
    return { ...data, dataCriacao: now.toDate() }
  } catch (error: any) {
    console.error('❌ Erro ao salvar mensagem:', {
      code: error.code,
      message: error.message,
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
  const snapshot = await db.collection('mensagens')
    .where('contaId', '==', contaId)
    .where('from', '==', numeroTelefone)
    .orderBy('timestamp', 'desc')
    .limit(limit)
    .get()
  
  return snapshot.docs.map(doc => ({ ...doc.data() } as Mensagem))
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
  } catch (error: any) {
    console.error('❌ Erro ao atualizar status:', {
      code: error.code,
      message: error.message,
      id: mensagemId
    })
    throw error
  }
}

