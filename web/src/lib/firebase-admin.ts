import { initializeApp, getApps, cert, App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

let app: App | undefined

// Não inicializa Firebase durante o build do Next.js
if (!getApps().length && process.env.FIREBASE_PROJECT_ID) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY
    if (!privateKey) {
      throw new Error('FIREBASE_PRIVATE_KEY não encontrada')
    }

    // Remover aspas extras e garantir que \n seja interpretado
    const cleanKey = privateKey
      .replace(/^"|"$/g, '') // Remove aspas do início/fim
      .replace(/\\n/g, '\n')  // Converte \n literal para quebra de linha real

    app = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
        privateKey: cleanKey,
      }),
    })
    
    // Configurar Firestore - conectar ao database específico "zybot-data"
    const db = getFirestore(app, 'zybot-data')
    db.settings({
      ignoreUndefinedProperties: true,
    })
    
    console.log('✅ Firebase Admin inicializado com sucesso')
    console.log('   Database:', db.databaseId)
  } catch (error) {
    console.error('❌ Erro ao inicializar Firebase Admin:', error)
  }
}

export const adminAuth = getAuth()
export const adminDb = getApps().length ? getFirestore(getApps()[0], 'zybot-data') : getFirestore()
