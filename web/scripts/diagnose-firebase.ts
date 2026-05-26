/**
 * Script de diagnóstico do Firebase
 * Verifica se as credenciais e conexão estão funcionando
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

async function diagnose() {
  console.log('🔍 Diagnóstico Firebase\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // 1. Verificar variáveis de ambiente
  console.log('1️⃣ Variáveis de ambiente:')
  console.log(`   FIREBASE_PROJECT_ID: ${process.env.FIREBASE_PROJECT_ID ? '✅' : '❌'} ${process.env.FIREBASE_PROJECT_ID || 'FALTANDO'}`)
  console.log(`   FIREBASE_CLIENT_EMAIL: ${process.env.FIREBASE_CLIENT_EMAIL ? '✅' : '❌'} ${process.env.FIREBASE_CLIENT_EMAIL?.substring(0, 30) || 'FALTANDO'}...`)
  console.log(`   FIREBASE_PRIVATE_KEY: ${process.env.FIREBASE_PRIVATE_KEY ? '✅' : '❌'} ${process.env.FIREBASE_PRIVATE_KEY ? '[presente]' : 'FALTANDO'}`)
  console.log('')

  // 2. Tentar inicializar Firebase
  console.log('2️⃣ Inicializando Firebase Admin...')
  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      })
    }
    console.log('   ✅ Firebase inicializado com sucesso')
  } catch (error: any) {
    console.log('   ❌ Erro ao inicializar:', error.message)
    process.exit(1)
  }
  console.log('')

  // 3. Testar Auth
  console.log('3️⃣ Testando Firebase Auth...')
  try {
    const auth = getAuth()
    const users = await auth.listUsers(1) // Listar 1 usuário
    console.log(`   ✅ Auth funcionando (${users.users.length} usuário(s) encontrado(s))`)
  } catch (error: any) {
    console.log('   ❌ Erro no Auth:', error.message)
  }
  console.log('')

  // 4. Testar Firestore
  console.log('4️⃣ Testando Firestore...')
  try {
    const db = getFirestore()
    
    // Tentar criar uma coleção de teste
    const testRef = await db.collection('_test').add({
      timestamp: new Date(),
      test: true
    })
    console.log('   ✅ Firestore funcionando (documento de teste criado)')
    
    // Deletar documento de teste
    await testRef.delete()
    console.log('   ✅ Documento de teste removido')
  } catch (error: any) {
    console.log('   ❌ Erro no Firestore:', error.message)
    console.log('   💡 Solução: Ative o Firestore no Firebase Console')
    console.log('   🌐 Acesse: https://console.firebase.google.com/project/' + process.env.FIREBASE_PROJECT_ID + '/firestore')
    console.log('   📌 Clique em "Criar banco de dados" e escolha o modo de produção ou teste')
  }
  console.log('')

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Diagnóstico concluído!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

diagnose()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
