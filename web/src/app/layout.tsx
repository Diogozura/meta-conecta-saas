import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL ??
  (process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://dybot.com.br");

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "DyBot — Automação via WhatsApp para Apps Meta",
    template: "%s | DyBot",
  },
  description:
    "DyBot é uma plataforma SaaS de automação de comunicação via WhatsApp Business API para aplicativos Meta. Crie bots, templates e gerencie conversas em um só lugar.",
  keywords: [
    "DyBot",
    "chatbot WhatsApp",
    "WhatsApp Business API",
    "automação Meta",
    "bot WhatsApp",
    "SaaS WhatsApp",
    "WABA",
    "atendimento automatizado",
  ],
  authors: [{ name: "DyBot" }],
  creator: "DyBot",
  publisher: "DyBot",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: appUrl,
    siteName: "DyBot",
    title: "DyBot — Automação via WhatsApp para Apps Meta",
    description:
      "Plataforma SaaS de bots e automação de mensagens via WhatsApp Business API para aplicativos Meta.",
    images: [
      {
        url: "/capa%20dybot.png",
        width: 1200,
        height: 630,
        alt: "DyBot — Automação WhatsApp para Apps Meta",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "DyBot — Automação via WhatsApp para Apps Meta",
    description:
      "Plataforma SaaS de bots e automação de mensagens via WhatsApp Business API para aplicativos Meta.",
    images: ["/capa%20dybot.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
