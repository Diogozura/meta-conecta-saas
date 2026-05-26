/**
 * Script para criar conta inicial de SuperAdmin e configurar integração Meta
 * 
 * Execute com: npm run setup-admin
 * ou: npx tsx scripts/setup-admin.ts
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
  })
}

interface SetupConfig {
  // Dados da conta
  nomeConta: string
  emailConta: string
  telefoneConta?: string
  
  // Dados do usuário admin
  nomeAdmin: string
  emailAdmin: string
  senhaAdmin: string
  
  // Dados da Meta (do .env.local)
  metaAppId: string
  metaWabaId: string
  metaPhoneNumberId: string
  metaBusinessToken: string
  metaBusinessId?: string
}

async function setupSuperAdmin(config: SetupConfig) {
  const db = getFirestore()
  const auth = getAuth()
  
  console.log('🚀 Iniciando configuração da conta SuperAdmin...\n')
  
  // 1. Criar conta no Firestore
  console.log('📦 Criando conta...')
  const contaRef = await db.collection('contas').add({
    nome: config.nomeConta,
    email: config.emailConta,
    telefone: config.telefoneConta || null,
    website: null,
    cnpj: null,
    dataCadastro: Timestamp.now(),
    dataAtualizacao: Timestamp.now(),
    status: 'ativo',
  })
  const contaId = contaRef.id
  console.log(`✅ Conta criada com ID: ${contaId}\n`)
  
  // 2. Criar usuário no Firebase Auth
  console.log('👤 Criando usuário no Firebase Auth...')
  let userRecord
  try {
    userRecord = await auth.createUser({
      email: config.emailAdmin,
      password: config.senhaAdmin,
      displayName: config.nomeAdmin,
      emailVerified: true, // SuperAdmin já vem verificado
    })
    console.log(`✅ Usuário criado no Auth: ${userRecord.uid}\n`)
  } catch (error: any) {
    if (error.code === 'auth/email-already-exists') {
      console.log('⚠️  Email já existe no Auth, buscando usuário...')
      userRecord = await auth.getUserByEmail(config.emailAdmin)
      console.log(`✅ Usuário encontrado: ${userRecord.uid}\n`)
    } else {
      throw error
    }
  }
  
  // 3. Criar usuário na subcoleção usuarios
  console.log('👥 Criando registro de usuário na conta...')
  const usuarioRef = await db.collection('contas').doc(contaId).collection('usuarios').add({
    contaId: contaId,
    nome: config.nomeAdmin,
    email: config.emailAdmin,
    avatar: null,
    nivel: 'proprietario',
    dataAcesso: Timestamp.now(),
    dataCadastro: Timestamp.now(),
    dataAtualizacao: Timestamp.now(),
    status: 'ativo',
  })
  console.log(`✅ Usuário criado na conta: ${usuarioRef.id}\n`)
  
  // 4. Salvar dados da integração Meta
  console.log('🔌 Configurando integração Meta/WhatsApp...')
  const metaAccessRef = await db.collection('contas').doc(contaId).collection('metaAccess').add({
    contaId: contaId,
    wabaId: config.metaWabaId,
    accessToken: config.metaBusinessToken,
    businessId: config.metaBusinessId || config.metaAppId,
    phoneNumberIds: [config.metaPhoneNumberId],
    dataAtualizacao: Timestamp.now(),
    dataExpiracao: null, // Tokens da Meta geralmente expiram em 60 dias
    status: 'ativo',
    webhookToken: process.env.META_WEBHOOK_VERIFY_TOKEN || null,
  })
  console.log(`✅ Integração Meta configurada: ${metaAccessRef.id}\n`)
  
  // 5. Resumo
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('🎉 CONFIGURAÇÃO CONCLUÍDA COM SUCESSO!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('')
  console.log('📋 Informações da conta:')
  console.log(`   Conta ID: ${contaId}`)
  console.log(`   Nome: ${config.nomeConta}`)
  console.log(`   Email: ${config.emailConta}`)
  console.log('')
  console.log('👤 Credenciais de acesso:')
  console.log(`   Email: ${config.emailAdmin}`)
  console.log(`   Senha: ${config.senhaAdmin}`)
  console.log(`   Nível: Proprietário (SuperAdmin)`)
  console.log('')
  console.log('🔌 Integração Meta:')
  console.log(`   WABA ID: ${config.metaWabaId}`)
  console.log(`   Phone Number ID: ${config.metaPhoneNumberId}`)
  console.log(`   Status: Ativo`)
  console.log('')
  console.log('🌐 Próximos passos:')
  console.log('   1. Acesse http://localhost:3000/login')
  console.log(`   2. Faça login com ${config.emailAdmin}`)
  console.log('   3. Acesse o Dashboard e comece a usar!')
  console.log('')
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIGURAÇÃO - Edite os valores abaixo
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const config: SetupConfig = {
  // Dados da conta/empresa
  nomeConta: 'Zybot',
  emailConta: 'contato@zybot.com.br',
  telefoneConta: '+55 11 99999-0000',
  
  // Dados do usuário SuperAdmin
  nomeAdmin: 'Administrador',
  emailAdmin: 'admin@zybot.com.br',
  senhaAdmin: 'Admin@123456', // ⚠️ MUDE ESTA SENHA!
  
  // Dados da Meta (valores do seu .env.local)
  metaAppId: process.env.NEXT_PUBLIC_META_APP_ID || '',
  metaWabaId: process.env.META_WABA_ID || '',
  metaPhoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
  metaBusinessToken: process.env.META_BUSINESS_TOKEN || '',
  metaBusinessId: process.env.META_WABA_ID, // Pode ser o mesmo que WABA_ID ou Business Manager ID
}

// Executar setup
setupSuperAdmin(config)
  .then(() => {
    console.log('✅ Script finalizado com sucesso!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Erro durante o setup:', error)
    process.exit(1)
  })
