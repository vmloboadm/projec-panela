import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import ErrorBoundary from "./components/ErrorBoundary";
import SWRegister from "./components/SWRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Panela da Roça — Gestão Financeira",
  description: "Sistema de gestão financeira para o restaurante Panela da Roça. Controle lançamentos, fechamentos e resultados.",
  manifest: "/manifest.json",
  icons: { icon: { url: "/favicon.ico", type: "image/x-icon" } },
  openGraph: {
    title: "Panela da Roça — Gestão Financeira",
    description: "Painel de gestão financeira do restaurante Panela da Roça.",
    images: ["/logo-panela-png.png"],
    url: "https://gestao-panela.com.br",
    type: "website",
  },
  appleWebApp: { capable: true, title: "Panela da Roça", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Providers>
        <SWRegister />
      </body>
    </html>
  );
}
