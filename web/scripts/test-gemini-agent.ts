/**
 * Teste manual do pipeline de IA (Gemini), sem enviar WhatsApp de verdade.
 * Usa a MESMA config real da conta (prompt, modelo, chave decriptada) e o
 * MESMO caminho de código (runGeminiAgent com function-calling), só sem
 * chamar sendTextMessage nem gravar mensagem — validação isolada, segura
 * de rodar quantas vezes quiser.
 *
 * Nota: os módulos de @/lib/* que dependem do Firebase Admin já inicializado
 * são carregados via require() DEPOIS do dotenv+initializeApp de propósito —
 * import ... no topo do arquivo é hoisted pelo TypeScript pro topo do
 * arquivo compilado, rodando antes do dotenv preencher as env vars.
 */
import { config } from 'dotenv'
import { resolve } from 'path'
config({ path: resolve(__dirname, '../.env.local') })

import { initializeApp, cert } from 'firebase-admin/app'

initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
  }),
})

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { obterConta } = require('../src/lib/firestore') as typeof import('../src/lib/firestore')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runGeminiAgent } = require('../src/lib/aiProviderGemini') as typeof import('../src/lib/aiProviderGemini')
import type { AgentRunParams } from '../src/lib/aiAgentTypes'

const CONTA_ID = 'yvGHJIsQeFtHAajxRTSy' // Diogo Zura — conta com o WhatsApp real conectado
const TELEFONE_TESTE = '5599999999999' // número fake, nunca usado de verdade

async function testarMensagem(rotulo: string, texto: string, systemPrompt: string, model: string, apiKey: string) {
  console.log(`\n=== ${rotulo} ===`)
  console.log('Mensagem:', texto)
  const params: AgentRunParams = {
    contaId: CONTA_ID,
    telefoneCliente: TELEFONE_TESTE,
    systemPrompt,
    model,
    apiKey,
    history: [],
    mensagemAtual: texto,
  }
  try {
    const resposta = await runGeminiAgent(params)
    console.log('✅ SUCESSO — resposta da IA:')
    console.log(resposta || '(vazio — a IA não gerou texto)')
  } catch (error) {
    console.log('❌ FALHOU:')
    console.log(error instanceof Error ? error.message : error)
  }
}

async function main() {
  const conta = await obterConta(CONTA_ID)
  if (!conta) {
    console.log('Conta não encontrada.')
    return
  }
  console.log('Conta:', conta.id)
  console.log('ai.enabled:', conta.ai?.enabled)
  console.log('ai.provider:', conta.ai?.provider)
  console.log('ai.model:', conta.ai?.model)
  console.log('ai.apiKey presente:', !!conta.ai?.apiKey, conta.ai?.apiKey ? `(len=${conta.ai.apiKey.length}, começa com "${conta.ai.apiKey.slice(0, 4)}")` : '')

  if (!conta.ai?.enabled || !conta.ai.apiKey || !conta.ai.model) {
    console.log('Config incompleta — abortando teste.')
    return
  }

  const systemPrompt = conta.ai.informacoesNegocio
    ? `${conta.ai.prompt}\n\n--- Informações do negócio ---\n${conta.ai.informacoesNegocio}`
    : conta.ai.prompt

  // 1) Mensagem simples, sem necessidade de ferramenta
  await testarMensagem('Teste 1: saudação simples (sem ferramenta)', 'Oi, tudo bem?', systemPrompt, conta.ai.model, conta.ai.apiKey)

  // 2) Mensagem que deve acionar a ferramenta listar_servicos (só leitura, sem efeito colateral)
  await testarMensagem('Teste 2: pergunta que aciona ferramenta (listar_servicos)', 'Quais serviços vocês oferecem e quanto custam?', systemPrompt, conta.ai.model, conta.ai.apiKey)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERRO GERAL:', e)
    process.exit(1)
  })
