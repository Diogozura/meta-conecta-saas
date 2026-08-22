import { NextResponse } from 'next/server'
import { getSessionWithPlatformAdmin } from '@/lib/auth'
import { listarContasAtivas } from '@/lib/firestore'
import { SERVICOS_PADRAO } from '@/lib/servicos'

// GET /api/admin/servicos - Lista todas as contas ativas com os serviços contratados de cada uma (admin de plataforma).
export async function GET() {
  const { isPlatformAdmin } = await getSessionWithPlatformAdmin()
  if (!isPlatformAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  try {
    const contas = await listarContasAtivas()
    const resultado = contas
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        email: c.email,
        servicosContratados: c.servicosContratados ?? SERVICOS_PADRAO,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome))
    return NextResponse.json({ contas: resultado })
  } catch (error) {
    console.error('Erro ao listar contas pra administração de serviços:', error)
    return NextResponse.json({ error: 'Erro ao listar contas' }, { status: 500 })
  }
}
