import { NextRequest, NextResponse } from 'next/server'
import { criarUsuario, listarUsuarios } from '@/lib/firestore'
import { auth } from '@/lib/auth'
import { NivelUsuario } from '@/types/database'

// GET /api/usuarios - Listar usuários
export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se tem permissão (apenas admin e proprietário podem listar usuários)
    if (session.user.nivel && !['admin', 'proprietario'].includes(session.user.nivel)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const usuarios = await listarUsuarios(session.user.contaId)
    return NextResponse.json({ usuarios })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}

// POST /api/usuarios - Criar usuário
export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.contaId) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Verificar se tem permissão (apenas admin e proprietário podem adicionar usuários)
    if (session.user.nivel && !['admin', 'proprietario'].includes(session.user.nivel)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    const body = await req.json()
    const { nome, email, nivel, status } = body

    if (!nome || !email || !nivel) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Validar nível
    const niveisValidos = Object.values(NivelUsuario)
    if (!niveisValidos.includes(nivel)) {
      return NextResponse.json({ error: 'Nível inválido' }, { status: 400 })
    }

    const usuario = await criarUsuario(session.user.contaId, {
      contaId: session.user.contaId,
      nome,
      email,
      nivel: nivel as NivelUsuario,
      status: status || 'ativo',
    })

    // Não há envio de email de convite: o acesso é liberado automaticamente
    // quando a pessoa faz login com o mesmo email (ver lib/auth.ts `auth()`).

    return NextResponse.json({ usuario }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    return NextResponse.json({ error: 'Erro ao criar usuário' }, { status: 500 })
  }
}
