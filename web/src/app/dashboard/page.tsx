import Link from 'next/link'
import { FileText, Plug, ArrowRight, Building2, Calendar } from 'lucide-react'
import { auth, getSessionWithPlatformAdmin } from '@/lib/auth'
import { obterConta, listarMensagens, listarAgendamentos, obterMetaAccess } from '@/lib/firestore'
import { listTemplates } from '@/lib/meta'
import { SERVICOS_PADRAO } from '@/lib/servicos'
import { WhatsAppGlyph, InstagramGlyph } from '@/components/BrandIcons'

const quickLinks = [
  { href: '/dashboard/conversas', label: 'Conversas', desc: 'Veja e responda suas conversas do WhatsApp', icon: WhatsAppGlyph, servico: 'whatsapp' as const, platformAdminOnly: false },
  { href: '/dashboard/agenda', label: 'Agenda', desc: 'Confira o calendário e os próximos agendamentos', icon: Calendar, servico: 'agenda' as const, platformAdminOnly: false },
  { href: '/dashboard/instagram', label: 'Instagram', desc: 'Veja mensagens diretas, comentários e publicações', icon: InstagramGlyph, servico: 'instagram' as const, platformAdminOnly: false },
  { href: '/dashboard/clientes', label: 'Gerenciar empresas', desc: 'Cadastre e administre as contas de clientes do SaaS', icon: Building2, servico: null, platformAdminOnly: true },
]

/** Início e fim do dia de hoje, no fuso do servidor — suficiente pra um resumo do painel (não precisa ser exato ao minuto). */
function limitesDoDia(): { inicio: Date; fim: Date } {
  const inicio = new Date()
  inicio.setHours(0, 0, 0, 0)
  const fim = new Date()
  fim.setHours(23, 59, 59, 999)
  return { inicio, fim }
}

export default async function DashboardPage() {
  const { isPlatformAdmin } = await getSessionWithPlatformAdmin()
  const session = await auth()
  const contaId = session?.user?.contaId ?? null

  const conta = contaId ? await obterConta(contaId) : null
  const servicos = conta?.servicosContratados ?? SERVICOS_PADRAO

  // Cada stat só é buscada se o serviço correspondente estiver contratado —
  // sem isso, uma conta sem WhatsApp ainda pagaria o custo de consultar o
  // Firestore/a Graph API por um número que ela nunca vai ver.
  let mensagensHoje = 0
  let numerosConectados = 0
  let templatesAtivos = 0
  let agendamentosHoje = 0

  if (contaId && servicos.whatsapp) {
    const { inicio } = limitesDoDia()
    const inicioUnix = Math.floor(inicio.getTime() / 1000)
    try {
      const recentes = await listarMensagens(contaId, 200)
      mensagensHoje = recentes.filter((m) => m.timestamp >= inicioUnix).length
    } catch (error) {
      console.error('Erro ao contar mensagens de hoje:', error)
    }

    try {
      const metaAccess = await obterMetaAccess(contaId)
      if (metaAccess) {
        numerosConectados = 1 + (metaAccess.numerosAdicionais?.length ?? 0)
        // Best-effort: a Graph API pode estar lenta/fora do ar, não pode
        // travar o carregamento do painel por causa de uma estatística.
        const templates = await listTemplates(metaAccess.wabaId, metaAccess.businessToken).catch(() => [])
        templatesAtivos = templates.filter((t) => t.status === 'APPROVED').length
      }
    } catch (error) {
      console.error('Erro ao buscar dados da Meta pro resumo do painel:', error)
    }
  }

  if (contaId && servicos.agenda) {
    try {
      const { inicio, fim } = limitesDoDia()
      const agendamentos = await listarAgendamentos(contaId, { de: inicio, ate: fim })
      agendamentosHoje = agendamentos.filter((a) => a.status !== 'cancelado').length
    } catch (error) {
      console.error('Erro ao contar agendamentos de hoje:', error)
    }
  }

  const stats = [
    ...(servicos.whatsapp
      ? [
          { label: 'Mensagens hoje', value: String(mensagensHoje), icon: WhatsAppGlyph, color: 'bg-brand-50 text-brand-600' },
          { label: 'Templates aprovados', value: String(templatesAtivos), icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: 'Números conectados', value: String(numerosConectados), icon: Plug, color: 'bg-orange-50 text-orange-600' },
        ]
      : []),
    ...(servicos.agenda ? [{ label: 'Agendamentos hoje', value: String(agendamentosHoje), icon: Calendar, color: 'bg-accent-50 text-accent-600' }] : []),
  ]

  const visibleQuickLinks = quickLinks.filter(
    (q) => (!q.platformAdminOnly || isPlatformAdmin) && (q.servico === null || servicos[q.servico])
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Stats */}
      {stats.length > 0 && (
        <div data-tour="dash-stats" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="bg-white rounded-xl border border-ink-200 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold text-ink-900 leading-none">{s.value}</p>
                  <p className="text-xs text-ink-500 mt-1 truncate">{s.label}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick access */}
      <div data-tour="dash-quicklinks">
        <h2 className="text-base font-semibold text-ink-800 mb-3">Acesso rápido</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleQuickLinks.map((q) => {
            const Icon = q.icon
            return (
              <Link
                key={q.href}
                href={q.href}
                className="bg-white rounded-xl border border-ink-200 p-5 hover:border-brand-400 hover:shadow-sm transition-all group flex items-start gap-4"
              >
                <div className="w-10 h-10 bg-ink-100 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-brand-50 transition-colors">
                  <Icon className="w-5 h-5 text-ink-500 group-hover:text-brand-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-ink-800 text-sm">{q.label}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{q.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-ink-300 group-hover:text-brand-500 mt-0.5 transition-colors shrink-0" />
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
