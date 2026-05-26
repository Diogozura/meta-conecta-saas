/**
 * Serviços para interação com Firebase Firestore
 * Use em Server Components ou Server Actions apenas
 */

import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { Conta, Usuario, MetaAccess, ContaVinculada, Cliente } from '@/types/database'

// Garante que apenas uma instância do Firestore é inicializada
// Firebase Admin já foi inicializado em lib/firebase-admin.ts
function getDb() {
  return getFirestore()
}

// ─────────────────────────────────────────
// CONTAS
// ─────────────────────────────────────────

export async function criarConta(data: Omit<Conta, 'id' | 'dataCadastro' | 'dataAtualizacao'>): Promise<Conta> {
  const db = getDb()
  const now = Timestamp.now()
  const docRef = await db.collection('contas').add({
    ...data,
    dataCadastro: now,
    dataAtualizacao: now,
  })
  return { id: docRef.id, ...data, dataCadastro: now.toDate(), dataAtualizacao: now.toDate() }
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
