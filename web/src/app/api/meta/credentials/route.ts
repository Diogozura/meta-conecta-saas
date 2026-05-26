import { NextRequest, NextResponse } from 'next/server'
import { auth, getSession } from '@/lib/auth'
import { obterMetaAccess, criarMetaAccess, atualizarMetaAccess, criarConta, criarUsuario } from '@/lib/firestore'
import { NivelUsuario } from '@/types/database'

// GET - Buscar credenciais da conta
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ credentials: null })
    }

    const metaAccess = await obterMetaAccess(session.user.contaId)
    
    if (!metaAccess) {
      return NextResponse.json({ credentials: null })
    }

    return NextResponse.json({
      credentials: {
        wabaId: metaAccess.wabaId,
        phoneNumberId: metaAccess.phoneNumberId,
        businessToken: metaAccess.businessToken,
        appId: metaAccess.appId,
        appSecret: metaAccess.appSecret,
        webhookVerifyToken: metaAccess.webhookVerifyToken,
        embeddedSignupConfigId: metaAccess.embeddedSignupConfigId,
      }
    })
  } catch (error) {
    console.error('Erro ao buscar credenciais:', error)
    return NextResponse.json({ error: 'Erro ao buscar credenciais' }, { status: 500 })
  }
}

// POST - Salvar/Atualizar credenciais
export async function POST(request: NextRequest) {
  try {
    const sessionData = await getSession()
    if (!sessionData?.email) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const session = await auth()
    let contaId = session?.user?.contaId

    // Se não tem conta, cria uma nova (primeira configuração)
    if (!contaId) {
      console.log('🚀 Criando primeira conta para:', sessionData.email)
      
      try {
        const novaConta = await criarConta({
          nome: sessionData.name || sessionData.email || 'Minha Empresa',
          email: sessionData.email,
          status: 'ativo'
        })
        
        contaId = novaConta.id
        
        // Criar usuário proprietário
        await criarUsuario(contaId, {
          contaId,
          nome: sessionData.name || sessionData.email || 'Usuário',
          email: sessionData.email,
          nivel: NivelUsuario.PROPRIETARIO,
          status: 'ativo'
        })
        
        console.log('✅ Conta criada:', contaId)
      } catch (error: any) {
        console.error('❌ Erro ao criar conta:', error)
        return NextResponse.json({ 
          error: 'Erro ao criar conta no Firebase. Verifique se a coleção "contas" existe no Firestore.',
          details: error.message 
        }, { status: 500 })
      }
    }

    const body = await request.json()
    const { wabaId, phoneNumberId, businessToken, appId, appSecret, webhookVerifyToken, embeddedSignupConfigId } = body

    // Validações básicas
    if (!wabaId || !phoneNumberId || !businessToken || !appId || !appSecret || !webhookVerifyToken) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
    }

    // Verificar se já existe
    const existing = await obterMetaAccess(contaId)

    if (existing) {
      // Atualizar
      await atualizarMetaAccess(contaId, existing.id, {
        wabaId,
        phoneNumberId,
        businessToken,
        appId,
        appSecret,
        webhookVerifyToken,
        embeddedSignupConfigId,
      })
    } else {
      // Criar novo
      await criarMetaAccess(contaId, {
        wabaId,
        phoneNumberId,
        businessToken,
        appId,
        appSecret,
        webhookVerifyToken,
        embeddedSignupConfigId,
      })
    }

    return NextResponse.json({ success: true, message: 'Credenciais salvas com sucesso!' })
  } catch (error: any) {
    console.error('❌ Erro ao salvar credenciais:', error)
    return NextResponse.json({ 
      error: 'Erro ao salvar credenciais',
      details: error.message || 'Erro desconhecido'
    }, { status: 500 })
  }
}
