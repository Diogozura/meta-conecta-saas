/**
 * Setup com configuração explícita do database
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore as getFirestoreAdmin, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Inicializar com configuração completa
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  })
}

async function setupWithDefaultDB() {
  console.log('🚀 Setup com database (default)...\n')
  
  // Usar o database (default) explicitamente  
  const db = getFirestoreAdmin()
  const auth = getAuth()
  
  const nomeConta = 'Zybot'
  const emailAdmin = 'admin@zybot.com.br'
  const senhaAdmin = 'Admin@123456'
  
  try {
    // 1. Criar conta
    console.log('📦 Criando conta...')
    const contaData = {
      nome: nomeConta,
      email: emailAdmin,
      telefone: null,
      website: null,
      cnpj: null,
      dataCadastro: Timestamp.now(),
      dataAtualizacao: Timestamp.now(),
      status: 'ativo',
    }
    
    const contaRef = await db.collection('contas').add(contaData)
    const contaId = contaRef.id
    console.log(`✅ Conta criada: ${contaId}`)
    
    // 2. Criar usuário Auth
    console.log('👤 Criando usuário...')
    let userRecord
    try {
      userRecord = await auth.createUser({
        email: emailAdmin,
        password: senhaAdmin,
        displayName: 'Administrador',
        emailVerified: true,
      })
    } catch (error: any) {
      if (error.code === 'auth/email-already-exists') {
        userRecord = await auth.getUserByEmail(emailAdmin)
        console.log('⚠️  Email já existe')
      } else {
        throw error
      }
    }
    console.log(`✅ Auth UID: ${userRecord.uid}`)
    
    // 3. Criar usuário na conta
    console.log('👥 Vinculando usuário...')
    await db.collection('contas').doc(contaId).collection('usuarios').add({
      contaId: contaId,
      nome: 'Administrador',
      email: emailAdmin,
      avatar: null,
      nivel: 'proprietario',
      dataAcesso: Timestamp.now(),
      dataCadastro: Timestamp.now(),
      dataAtualizacao: Timestamp.now(),
      status: 'ativo',
    })
    console.log('✅ Usuário vinculado')
    
    // 4. Salvar Meta Access
    console.log('🔌 Configurando Meta...')
    await db.collection('contas').doc(contaId).collection('metaAccess').add({
      contaId: contaId,
      wabaId: process.env.META_WABA_ID!,
      accessToken: process.env.META_BUSINESS_TOKEN!,
      businessId: process.env.META_WABA_ID!,
      phoneNumberIds: [process.env.META_PHONE_NUMBER_ID!],
      dataAtualizacao: Timestamp.now(),
      dataExpiracao: null,
      status: 'ativo',
      webhookToken: process.env.META_WEBHOOK_VERIFY_TOKEN || null,
    })
    console.log('✅ Meta configurado')
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('✅ SETUP CONCLUÍDO!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('📋 Acesse o sistema:')
    console.log('   URL: http://localhost:3000/login')
    console.log(`   Email: ${emailAdmin}`)
    console.log(`   Senha: ${senhaAdmin}`)
    console.log('\n⚠️  IMPORTANTE: Mude a senha após o primeiro login!\n')
    
  } catch (error: any) {
    console.error('\n❌ Erro:', error.message)
    
    if (error.message.includes('NOT_FOUND')) {
      console.error('\n💡 O Firestore pode precisar ser inicializado manualmente.')
      console.error('   Vá no Firebase Console e crie UMA coleção manualmente:')
      console.error('   1. Clique em "+ Iniciar coleção"')
      console.error('   2. Nome: "contas"')
      console.error('   3. ID do primeiro documento: "temp"')
      console.error('   4. Campo: "teste" = true')
      console.error('   5. Depois pode deletar esse documento')
      console.error('   6. Execute o script novamente\n')
    }
    
    throw error
  }
}

setupWithDefaultDB()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Falhou:', error)
    process.exit(1)
  })
