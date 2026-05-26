/**
 * Script de teste - Preenche credenciais da Meta no Firebase
 * Execute com: npm run test-credentials
 */

import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

// Inicializar Firebase Admin
if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (!privateKey) {
    throw new Error('FIREBASE_PRIVATE_KEY não encontrada no .env.local')
  }

  // Remover aspas extras e garantir que \n seja interpretado
  const cleanKey = privateKey
    .replace(/^"|"$/g, '') // Remove aspas do início/fim
    .replace(/\\n/g, '\n') // Converte \n literal para quebra de linha real

  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: cleanKey,
    }),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  })
  
  console.log('✅ Firebase Admin inicializado')
  console.log('   Project:', process.env.FIREBASE_PROJECT_ID)
}

// Tentar conectar ao database específico "zybot-data"
let db
try {
  db = getFirestore(undefined, 'zybot-data')
  console.log('🔧 Conectado ao database: zybot-data')
} catch {
  db = getFirestore()
  console.log('🔧 Conectado ao database: (default)')
}

db.settings({ ignoreUndefinedProperties: true })
const auth = getAuth()

console.log('🔧 Configurações:')
console.log('   Project ID:', process.env.FIREBASE_PROJECT_ID)
console.log('   Database:', db.databaseId || '(default)')
console.log('')

async function main() {
  console.log('🧪 Iniciando testes...\n')

  try {
    // TESTE 1: Verificar se consegue listar coleções existentes
    console.log('📋 TESTE 1: Listando coleções existentes...')
    try {
      const collections = await db.listCollections()
      console.log('✅ Acesso ao Firestore OK!')
      console.log('   Coleções encontradas:', collections.map(c => c.id).join(', '))
    } catch (error: any) {
      console.error('❌ Erro ao listar coleções:', error.message)
      console.log('\n🔴 PROBLEMA: Firebase Admin não consegue acessar o Firestore')
      console.log('\n📝 Possíveis soluções:')
      console.log('1. Verifique as REGRAS DE SEGURANÇA no Firebase Console')
      console.log('   https://console.firebase.google.com/project/zybot-data/firestore/rules')
      console.log('   Cole estas regras:')
      console.log('   rules_version = \'2\';')
      console.log('   service cloud.firestore {')
      console.log('     match /databases/{database}/documents {')
      console.log('       match /{document=**} {')
      console.log('         allow read, write: if request.auth != null;')
      console.log('       }')
      console.log('     }')
      console.log('   }')
      console.log('\n2. Aguarde 1-2 minutos após publicar as regras')
      console.log('3. Execute este script novamente')
      process.exit(1)
    }

    console.log('')

    // 1. Buscar ou criar usuário no Firebase Auth
    const email = 'admin@zybot.com'
    const password = 'Admin@123'
    
    let user
    try {
      user = await auth.getUserByEmail(email)
      console.log('✅ Usuário já existe:', user.uid)
    } catch {
      user = await auth.createUser({
        email,
        password,
        displayName: 'Administrador',
        emailVerified: true
      })
      console.log('✅ Usuário criado:', user.uid)
    }

    // 2. Tentar criar conta diretamente (para garantir que a coleção existe)
    let contaId: string
    
    try {
      console.log('\n📝 Criando conta...')
      const contaRef = await db.collection('contas').add({
        nome: 'ZyBot - Conta Principal',
        email,
        status: 'ativo',
        dataCadastro: Timestamp.now(),
        dataAtualizacao: Timestamp.now(),
      })
      contaId = contaRef.id
      console.log('✅ Conta criada:', contaId)
    } catch (error: any) {
      console.error('❌ Erro ao criar conta:', error.message)
      console.log('\n⚠️ Detalhes do erro:', error.code, error.details)
      console.log('\n📝 Verifique:')
      console.log('1. As regras de segurança permitem escrita')
      console.log('2. O Firebase Admin SDK está configurado corretamente')
      console.log('3. Não há conflito de nomes ou IDs')
      process.exit(1)
    }

    // 3. Criar usuário proprietário na subcoleção
    console.log('\n👤 Criando usuário proprietário...')
    await db.collection('contas').doc(contaId).collection('usuarios').add({
      nome: 'Administrador',
      email,
      nivel: 'proprietario',
      status: 'ativo',
      dataCadastro: Timestamp.now(),
      dataAtualizacao: Timestamp.now(),
    })
    console.log('✅ Usuário proprietário criado')

    // 4. Salvar credenciais da Meta
    console.log('\n🔑 Salvando credenciais da Meta...')
    const credenciais = {
      wabaId: process.env.META_WABA_ID!,
      phoneNumberId: process.env.META_PHONE_NUMBER_ID!,
      businessToken: process.env.META_BUSINESS_TOKEN!,
      appId: process.env.NEXT_PUBLIC_META_APP_ID!,
      appSecret: process.env.META_APP_SECRET!,
      webhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN!,
      embeddedSignupConfigId: process.env.NEXT_PUBLIC_META_EMBEDDED_SIGNUP_CONFIG_ID,
      dataAtualizacao: Timestamp.now(),
    }

    await db.collection('contas').doc(contaId).collection('metaAccess').add(credenciais)
    console.log('✅ Credenciais salvas')

    // 5. Verificação final
    console.log('\n📊 Verificação final:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Conta ID: ${contaId}`)
    console.log(`Email: ${email}`)
    console.log(`WABA ID: ${credenciais.wabaId}`)
    console.log(`Phone ID: ${credenciais.phoneNumberId}`)
    console.log(`App ID: ${credenciais.appId}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    console.log('\n🎉 SUCESSO! Tudo configurado corretamente!')
    console.log('\n📝 Credenciais de login:')
    console.log(`   Email: ${email}`)
    console.log(`   Senha: ${password}`)
    console.log('\n🚀 Acesse: http://localhost:3000/login')

  } catch (error: any) {
    console.error('\n❌ ERRO:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

main()
