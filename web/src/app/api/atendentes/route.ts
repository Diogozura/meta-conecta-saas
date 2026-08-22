import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarUsuarios, criarUsuario, obterConta, registrarAuditoria } from '@/lib/firestore'
import { NivelUsuario } from '@/types/database'
import { enviarEmail, emailConviteAtendente } from '@/lib/notificacoes'

// GET /api/atendentes - Lista os atendentes (Usuario do Firestore — o mesmo modelo usado pra login/atendenteId, não o CRM novo de /api/usuarios).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  try {
    const atendentes = await listarUsuarios(session.user.contaId)
    return NextResponse.json({ atendentes })
  } catch (error) {
    console.error('Erro ao listar atendentes:', error)
    return NextResponse.json({ error: 'Erro ao listar atendentes' }, { status: 500 })
  }
}

const NIVEIS_CONVITE = new Set([NivelUsuario.ADMIN, NivelUsuario.OPERADOR, NivelUsuario.VISUALIZADOR])

/**
 * POST /api/atendentes - Convida um novo atendente. Não existe fluxo de
 * senha pra quem é convidado (evita construir provisionamento de conta do
 * zero) — o convidado ativa o acesso entrando com Google usando o MESMO
 * e-mail, no login normal. `auth()` já reconhece esse e-mail (status
 * 'convite_pendente') e ativa sozinho no primeiro login — não precisa de
 * nenhuma tela nova de "aceitar convite".
 */
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  // Só proprietário/admin convida gente nova pra equipe.
  if (session.user.nivel !== NivelUsuario.PROPRIETARIO && session.user.nivel !== NivelUsuario.ADMIN) {
    return NextResponse.json({ error: 'Só administradores podem convidar atendentes.' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const nivel = NIVEIS_CONVITE.has(body?.nivel) ? (body.nivel as NivelUsuario) : NivelUsuario.OPERADOR
  const setor = typeof body?.setor === 'string' ? body.setor.trim() || null : null

  if (!nome || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Nome e e-mail válido são obrigatórios' }, { status: 400 })
  }

  try {
    const existentes = await listarUsuarios(session.user.contaId)
    if (existentes.some((u) => u.email.toLowerCase() === email)) {
      return NextResponse.json({ error: 'Já existe um atendente com esse e-mail nessa conta' }, { status: 409 })
    }

    const atendente = await criarUsuario(session.user.contaId, { contaId: session.user.contaId, nome, email, nivel, status: 'convite_pendente', setor })

    const conta = await obterConta(session.user.contaId)
    const urlLogin = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/login`
    const { assunto, corpoHtml } = emailConviteAtendente({ nomeConta: conta?.nome ?? 'sua equipe', nomeConvidado: nome, urlLogin })
    const enviado = await enviarEmail({ para: email, assunto, corpoHtml })

    await registrarAuditoria(session.user.contaId, {
      entidade: 'atendente',
      entidadeId: atendente.id,
      acao: 'convidar',
      descricao: `Convidou ${nome} (${email}) como atendente`,
      usuarioId: session.user.usuarioId ?? 'desconhecido',
      usuarioNome: session.user.name ?? session.user.email ?? 'Atendente',
    }).catch(() => {})

    return NextResponse.json({ atendente, emailEnviado: enviado }, { status: 201 })
  } catch (error) {
    console.error('Erro ao convidar atendente:', error)
    return NextResponse.json({ error: 'Erro ao convidar atendente' }, { status: 500 })
  }
}
