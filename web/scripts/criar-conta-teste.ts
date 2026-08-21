/**
 * Cria uma conta simples de teste (login + conta vazia) — pra passar
 * credenciais pra um revisor da Meta testar o app manualmente, sem
 * depender de nenhuma credencial real de WhatsApp/Meta.
 *
 * Execute com: npm run criar-conta-teste
 */

// IMPORTANTE: carregar dotenv ANTES de qualquer import do Firebase
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, getApps, cert } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/^"|"$/g, '')
    .replace(/\\n/g, '\n')

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

// Mesmo database nomeado que o app usa em produção (lib/firebase-admin.ts) —
// sem isso, a conta seria criada no database "(default)" e o app nunca a acharia.
const db = getFirestore(getApps()[0], 'zybot-data')
db.settings({ ignoreUndefinedProperties: true })

async function criarContaTeste() {
  const auth = getAuth()

  const nomeConta = 'Conta de teste (revisor Meta)'
  const email = 'revisor.meta@zybot.com.br'
  const senha = 'RevisorMeta@2026'

  console.log('🚀 Criando conta de teste...\n')

  // 1. Conta
  const contaRef = await db.collection('contas').add({
    nome: nomeConta,
    email,
    dataCadastro: Timestamp.now(),
    dataAtualizacao: Timestamp.now(),
    status: 'ativo',
  })
  const contaId = contaRef.id
  console.log(`✅ Conta criada: ${contaId}`)

  // 2. Usuário no Firebase Auth
  let userRecord
  try {
    userRecord = await auth.createUser({
      email,
      password: senha,
      displayName: 'Revisor Meta',
      emailVerified: true,
    })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'auth/email-already-exists') {
      userRecord = await auth.getUserByEmail(email)
      console.log('⚠️  Email já existia, reutilizando o usuário do Auth')
    } else {
      throw error
    }
  }
  console.log(`✅ Usuário Auth: ${userRecord.uid}`)

  // 3. Vincula o usuário à conta como proprietário
  await db.collection('contas').doc(contaId).collection('usuarios').add({
    contaId,
    nome: 'Revisor Meta',
    email,
    nivel: 'proprietario',
    dataCadastro: Timestamp.now(),
    dataAtualizacao: Timestamp.now(),
    status: 'ativo',
  })
  console.log('✅ Usuário vinculado à conta como proprietário')

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ CONTA DE TESTE PRONTA')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('URL:   https://www.zybot.com.br/login')
  console.log(`Email: ${email}`)
  console.log(`Senha: ${senha}`)
  console.log('\nConta vazia, sem número de WhatsApp conectado — serve pra')
  console.log('navegar pelo painel e pelo fluxo de "Conectar WhatsApp Business"')
  console.log('(dashboard/onboarding). Não inclua isso no repositório nem em')
  console.log('nenhum lugar público — passe direto pro campo de credenciais')
  console.log('de teste do formulário de Análise do App.\n')
}

criarContaTeste()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Erro:', error)
    process.exit(1)
  })
