/**
 * Script simplificado - usa os dados do .env.local diretamente
 * 
 * Execute com: npm run setup-admin-quick
 */

// IMPORTANTE: Carregar dotenv ANTES de qualquer import do Firebase
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

// Agora sim pode importar Firebase
import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Inicializar Firebase Admin manualmente aqui
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  })
}

// Importante: usar o database padrão (default)
const db = getFirestore()
db.settings({ 
  ignoreUndefinedProperties: true 
})

async function quickSetup() {
  const auth = getAuth()
  
  // Validar variáveis de ambiente
  const required = ['META_WABA_ID', 'META_PHONE_NUMBER_ID', 'META_BUSINESS_TOKEN']
  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    console.error('❌ Variáveis de ambiente faltando no .env.local:')
    missing.forEach(key => console.error(`   - ${key}`))
    process.exit(1)
  }
  
  console.log('🚀 Setup Rápido - Criando conta SuperAdmin...\n')
  
  // Configuração padrão
  const nomeConta = 'Zybot'
  const emailAdmin = 'admin@zybot.com.br'
  const senhaAdmin = 'Admin@123456' // ⚠️ MUDE DEPOIS DO PRIMEIRO LOGIN!
  
  // 1. Criar conta
  console.log('📦 Criando conta...')
  const contaRef = await db.collection('contas').add({
    nome: nomeConta,
    email: emailAdmin,
    telefone: null,
    website: null,
    cnpj: null,
    dataCadastro: Timestamp.now(),
    dataAtualizacao: Timestamp.now(),
    status: 'ativo',
  })
  const contaId = contaRef.id
  console.log(`✅ Conta: ${contaId}`)
  
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
      console.log('⚠️  Email já existe, usando usuário existente')
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
}

quickSetup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
