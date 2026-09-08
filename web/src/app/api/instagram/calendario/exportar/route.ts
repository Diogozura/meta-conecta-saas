import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { listarPublicacoesInstagram } from '@/lib/firestore'
import { gerarIcsPublicacoesInstagram } from '@/lib/icsInstagram'

// GET /api/instagram/calendario/exportar - Baixa um arquivo .ics com os agendamentos do
// Instagram, pra importar no Google Calendar (ou Outlook/Apple Calendar — é um formato aberto).
export async function GET() {
  const session = await auth()
  if (!session?.user?.contaId) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  }

  const publicacoes = await listarPublicacoesInstagram(session.user.contaId, 200)
  const ics = gerarIcsPublicacoesInstagram(publicacoes)

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="calendario-instagram-zybot.ics"',
    },
  })
}
