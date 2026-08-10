import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Criar conta',
  description: 'Crie sua conta no DyBot e comece a gerenciar bots, templates e conversas via WhatsApp Business API.',
  robots: { index: false, follow: false },
}

export default function CadastroLayout({ children }: { children: React.ReactNode }) {
  return children
}
