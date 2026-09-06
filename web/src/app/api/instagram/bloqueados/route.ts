import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { bloquearUsuarioInstagram, listarUsuariosBloqueadosInstagram, registrarAuditoria } from '@/lib/firestore'

// GET /api/instagram/bloqueados - Lista de usuários "bloqueados" (moderação do lado do Zybot —
// ver InstagramBloqueado em types/database.ts sobre por que não existe bloqueio de verdade na API)
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const bloqueados = await listarUsuariosBloqueadosInstagram(session.user.contaId)
    return NextResponse.json({ bloqueados })
  } catch (error) {
    console.error('Erro ao listar usuários bloqueados do Instagram:', error)
    return NextResponse.json({ error: 'Erro ao listar bloqueados' }, { status: 500 })
  }
}

// POST /api/instagram/bloqueados - Bloqueia um username (comentários novos dele são ocultados
// automaticamente daqui pra frente — não afeta comentários antigos nem impede DM de chegar).
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim().replace(/^@/, '') : ''
  const motivo = typeof body?.motivo === 'string' ? body.motivo.trim() : undefined
  if (!username) {
    return NextResponse.json({ error: 'username é obrigatório' }, { status: 400 })
  }

  try {
    const bloqueado = await bloquearUsuarioInstagram(session.user.contaId, username, motivo)
    await registrarAuditoria(session.user.contaId, {
      entidade: 'instagram_conta',
      acao: 'criar',
      descricao: `Bloqueou @${username}${motivo ? ` (${motivo})` : ''}`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})
    return NextResponse.json({ bloqueado }, { status: 201 })
  } catch (error) {
    console.error('Erro ao bloquear usuário do Instagram:', error)
    return NextResponse.json({ error: 'Erro ao bloquear usuário' }, { status: 500 })
  }
}
