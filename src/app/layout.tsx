export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Meta Ads Dashboard',
  description: 'Painel de métricas para campanhas Meta Ads',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
