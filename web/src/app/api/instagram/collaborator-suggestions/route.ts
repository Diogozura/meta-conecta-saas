import { NextResponse } from 'next/server'
import { getInstagramCredentials, listConversations } from '@/lib/instagram'
import { listarUsernamesComentaristas, listarPublicacoesInstagram } from '@/lib/firestore'
import { auth } from '@/lib/auth'

// GET /api/instagram/collaborator-suggestions - Sugestões de @usuário pra marcar como
// colaborador. NÃO é busca de usuário do Instagram (a Graph API não expõe isso pra contas
// arbitrárias) — é só quem já interagiu com essa conta: comentaristas, contatos de DM e
// colaboradores já usados em publicações anteriores.
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }
  const contaId = session.user.contaId

  const usernames = new Set<string>()

  const [comentaristas, publicacoes, credentials] = await Promise.all([
    listarUsernamesComentaristas(contaId).catch(() => []),
    listarPublicacoesInstagram(contaId, 100).catch(() => []),
    getInstagramCredentials().catch(() => null),
  ])

  comentaristas.forEach((u) => usernames.add(u))
  publicacoes.forEach((p) => p.collaborators?.forEach((u) => usernames.add(u)))

  if (credentials) {
    try {
      const conversas = await listConversations(credentials.accessToken, credentials.igUserId)
      for (const c of conversas) {
        for (const p of c.participants?.data ?? []) {
          if (p.username && p.id !== credentials.igUserId) usernames.add(p.username)
        }
      }
    } catch {
      // Sem DMs disponíveis não é motivo pra falhar a sugestão inteira.
    }
  }

  return NextResponse.json({ usernames: Array.from(usernames).sort() })
}
