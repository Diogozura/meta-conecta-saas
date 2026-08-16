'use server'

import { adminAuth, adminDb } from './firebase-admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { obterIndiceUsuarioPorUid, salvarIndiceUsuarioPorUid, obterUsuario, atualizarUsuario } from './firestore'

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000 // 7 dias em ms
const SESSION_MAX_AGE_S = SESSION_MAX_AGE_MS / 1000  // 7 dias em segundos

/**
 * "Admin de plataforma" = dono(s)/equipe do SaaS, com acesso à tela de
 * Empresas (CRM administrativo, vê/gerencia TODAS as empresas). Usuários
 * comuns de uma empresa (mesmo Administrador daquela empresa) NUNCA são
 * admin de plataforma — só quem estiver nesta lista. Configurado via
 * PLATFORM_ADMIN_EMAILS em web/.env.local (e-mails separados por vírgula).
 */
const PLATFORM_ADMIN_EMAILS = (process.env.PLATFORM_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

// Não exportada: em arquivo com 'use server', todo export precisa ser uma
// função async (vira Server Action) — mantida privada, usada só pelas
// funções async abaixo.
function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return PLATFORM_ADMIN_EMAILS.includes(email.toLowerCase())
}

/** Sessão + flag de admin de plataforma, para gates de página/layout/API routes. */
export async function getSessionWithPlatformAdmin() {
  const session = await getSession()
  return { session, isPlatformAdmin: isPlatformAdminEmail(session?.email) }
}

/**
 * Cria uma sessão autenticada a partir de um Firebase ID Token.
 * Chamado pelo cliente após login bem-sucedido.
 */
export async function setSession(idToken: string): Promise<{ success: boolean; error?: string }> {
  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MAX_AGE_MS,
    })
    const cookieStore = await cookies()
    cookieStore.set('session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE_S,
      path: '/',
      sameSite: 'lax',
    })
    return { success: true }
  } catch {
    return { success: false, error: 'Falha ao criar sessão. Tente novamente.' }
  }
}

/**
 * Verifica e retorna os dados da sessão atual.
 * Use em Server Components ou Server Actions que precisam do usuário autenticado.
 */
export async function getSession() {
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get('session')?.value
  if (!sessionCookie) return null
  try {
    return await adminAuth.verifySessionCookie(sessionCookie, true)
  } catch {
    return null
  }
}

/**
 * Retorna informações completas do usuário autenticado incluindo contaId
 */
export async function auth() {
  const session = await getSession()
  if (!session) return null

  try {
    // Caminho rápido: já resolvemos esse uid antes, 1 leitura + 1 leitura
    // do usuário (em vez de escanear todas as "contas"). Se o índice
    // apontar pra um usuário que não existe mais (removido/movido), cai
    // pro scan completo abaixo e re-heala o índice.
    const indice = await obterIndiceUsuarioPorUid(session.uid)
    if (indice) {
      const usuario = await obterUsuario(indice.contaId, indice.usuarioId)
      if (usuario) {
        if (usuario.status === 'convite_pendente') {
          await atualizarUsuario(indice.contaId, indice.usuarioId, { status: 'ativo' })
          usuario.status = 'ativo'
        }
        return {
          user: {
            uid: session.uid,
            email: session.email || '',
            name: usuario.nome || '',
            contaId: indice.contaId,
            usuarioId: indice.usuarioId,
            nivel: usuario.nivel,
          }
        }
      }
    }

    const { getApps } = await import('firebase-admin/app')
    const db = getFirestore(getApps()[0], 'zybot-data')

    // Buscar usuário em todas as contas (subcoleção usuarios) — só chega
    // aqui no "cache miss" (primeira vez desse uid, ou índice desatualizado).
    let contasSnapshot
    try {
      contasSnapshot = await db.collection('contas').get()
    } catch (error: unknown) {
      // Se a coleção não existe ainda (5 NOT_FOUND), retorna dados básicos
      console.error('Erro ao buscar dados do usuário:', error)
      return {
        user: {
          uid: session.uid,
          email: session.email || '',
          name: session.name || session.email || '',
          contaId: null,
          usuarioId: null,
          nivel: null,
        }
      }
    }

    for (const contaDoc of contasSnapshot.docs) {
      const usuariosSnapshot = await contaDoc.ref.collection('usuarios')
        .where('email', '==', session.email)
        .limit(1)
        .get()

      if (!usuariosSnapshot.empty) {
        const usuarioDoc = usuariosSnapshot.docs[0]
        const usuarioData = usuarioDoc.data()

        // Primeiro login do convite: marca o usuário como ativo
        if (usuarioData.status === 'convite_pendente') {
          await usuarioDoc.ref.update({ status: 'ativo', dataAtualizacao: Timestamp.now() })
          usuarioData.status = 'ativo'
        }

        // Popula o índice pra próxima chamada não precisar escanear tudo de novo.
        salvarIndiceUsuarioPorUid(session.uid, {
          contaId: contaDoc.id,
          usuarioId: usuarioDoc.id,
          email: session.email || '',
        }).catch((err) => console.error('Erro ao salvar índice uid->conta:', err))

        return {
          user: {
            uid: session.uid,
            email: session.email || '',
            name: usuarioData.nome || '',
            contaId: contaDoc.id,
            usuarioId: usuarioDoc.id,
            nivel: usuarioData.nivel,
          }
        }
      }
    }

    // Se não encontrou o usuário em nenhuma conta, retorna dados básicos
    return {
      user: {
        uid: session.uid,
        email: session.email || '',
        name: session.name || session.email || '',
        contaId: null, // Usuário sem conta vinculada
        usuarioId: null,
        nivel: null,
      }
    }
  } catch (error) {
    console.error('Erro ao buscar dados do usuário:', error)
    return null
  }
}

/**
 * Retorna o valor bruto do cookie de sessão, para ser reenviado como
 * `Authorization: Bearer <cookie>` ao backend FastAPI — que valida tanto
 * ID Tokens quanto session cookies (ver backend/app/auth/firebase_auth.py).
 */
export async function getSessionCookieValue(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('session')?.value ?? null
}

export interface BackendUserSession {
  uid: string
  email: string
  id: string // id do documento em users/{id} (backend FastAPI)
  companyId: string
  name: string
  role: string
  accessLevel: string
  sector: string | null
  status: string
}

/**
 * Resolve o usuário autenticado no modelo do backend FastAPI (coleção
 * `users`, raiz, campo `companyId`) — diferente de `auth()`, que resolve
 * no modelo legado `contas/{contaId}/usuarios`. Use esta função nas
 * features que já migraram para o backend (ex: Usuários, Empresas).
 */
export async function getBackendUser(): Promise<BackendUserSession | null> {
  const session = await getSession()
  if (!session) return null

  try {
    const snapshot = await adminDb.collection('users').where('firebaseUid', '==', session.uid).limit(1).get()
    if (snapshot.empty) return null

    const doc = snapshot.docs[0]
    const data = doc.data()
    return {
      uid: session.uid,
      email: session.email || '',
      id: doc.id,
      companyId: data.companyId,
      name: data.name,
      role: data.role,
      accessLevel: data.accessLevel,
      sector: data.sector ?? null,
      status: data.status,
    }
  } catch (error) {
    console.error('Erro ao resolver usuário do backend:', error)
    return null
  }
}

/**
 * Encerra a sessão do usuário e redireciona para o login.
 */
export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}
