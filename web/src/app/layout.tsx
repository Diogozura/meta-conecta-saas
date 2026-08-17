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
    default: "Zybot — Atendimento, Agenda e IA no WhatsApp",
    template: "%s | Zybot",
  },
  description:
    "Zybot é a plataforma que reúne conversas, agenda e um agente de IA em um só lugar — hoje no WhatsApp Business API, com Instagram e Facebook em breve.",
  keywords: [
    "Zybot",
    "chatbot WhatsApp",
    "WhatsApp Business API",
    "automação Meta",
    "bot WhatsApp",
    "SaaS WhatsApp",
    "WABA",
    "atendimento automatizado",
  ],
  authors: [{ name: "Zybot" }],
  creator: "Zybot",
  publisher: "Zybot",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: appUrl,
    siteName: "Zybot",
    title: "Zybot — Atendimento, Agenda e IA no WhatsApp",
    description:
      "Conversas, agenda e um agente de IA em um só lugar — hoje no WhatsApp Business API, com Instagram e Facebook em breve.",
    images: [
      {
        url: "/capa%20dybot.png",
        width: 1200,
        height: 630,
        alt: "Zybot — Atendimento, Agenda e IA no WhatsApp",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zybot — Atendimento, Agenda e IA no WhatsApp",
    description:
      "Conversas, agenda e um agente de IA em um só lugar — hoje no WhatsApp Business API, com Instagram e Facebook em breve.",
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
