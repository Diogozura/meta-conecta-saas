'use server'

import { adminAuth } from './firebase-admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000 // 7 dias em ms
const SESSION_MAX_AGE_S = SESSION_MAX_AGE_MS / 1000  // 7 dias em segundos

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
    const { getApps } = await import('firebase-admin/app')
    const db = getFirestore(getApps()[0], 'zybot-data')
    
    // Buscar usuário em todas as contas (subcoleção usuarios)
    // Nota: Em produção, seria melhor armazenar a relação uid -> contaId em uma coleção separada
    let contasSnapshot
    try {
      contasSnapshot = await db.collection('contas').get()
    } catch (error: any) {
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
 * Encerra a sessão do usuário e redireciona para o login.
 */
export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}
