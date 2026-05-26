'use server'

import { adminAuth } from './firebase-admin'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

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
 * Encerra a sessão do usuário e redireciona para o login.
 */
export async function logout() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
  redirect('/login')
}
