/**
 * Teste simples de escrita no Firestore
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

// Inicializar
if (!getApps().length) {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
  console.log('✅ Firebase inicializado:', app.name)
}

async function testeEscrita() {
  console.log('\n🧪 Testando escrita no Firestore...\n')
  
  const db = getFirestore()
  console.log('Database ID:', (db as any)._settings.projectId)
  
  try {
    // Tentar criar documento de teste
    console.log('📝 Criando documento de teste...')
    const docRef = db.collection('teste_setup').doc('teste')
    
    await docRef.set({
      teste: true,
      timestamp: Timestamp.now(),
      mensagem: 'Script de setup funcionando!'
    })
    
    console.log('✅ Documento criado com sucesso!')
    
    // Ler o documento
    const snap = await docRef.get()
    console.log('✅ Documento lido:', snap.data())
    
    // Deletar
    await docRef.delete()
    console.log('✅ Documento deletado\n')
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ FIRESTORE FUNCIONANDO!')
    console.log('Agora você pode rodar: npm run setup-admin-quick')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
  } catch (error: any) {
    console.error('❌ Erro ao escrever:', error.message)
    console.error('\n💡 Possíveis soluções:')
    console.error('1. Verifique as regras do Firestore (aba Segurança)')
    console.error('2. Certifique-se que a Service Account tem permissões')
    console.error('3. Verifique se o Firestore está em modo Produção')
    console.error('\nErro completo:', error)
  }
}

testeEscrita()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Erro:', error)
    process.exit(1)
  })
