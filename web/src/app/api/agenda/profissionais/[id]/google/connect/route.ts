import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { obterProfissional } from '@/lib/firestore'
import { getGoogleAuthUrl } from '@/lib/googleCalendar'

// GET /api/agenda/profissionais/[id]/google/connect
// Inicia o fluxo OAuth: redireciona o navegador pra tela de consentimento do Google.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const { id } = await params
  const profissional = await obterProfissional(session.user.contaId, id)
  if (!profissional) {
    return NextResponse.json({ error: 'Profissional não encontrado' }, { status: 404 })
  }

  // state carrega contaId+profissionalId pro callback saber onde salvar o
  // token; o callback revalida contaId contra a sessão atual antes de gravar.
  const state = Buffer.from(JSON.stringify({ contaId: session.user.contaId, profissionalId: id })).toString('base64url')

  try {
    const url = getGoogleAuthUrl(state)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('Erro ao montar URL de autenticação do Google:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro ao iniciar conexão com o Google' }, { status: 500 })
  }
}
