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
  description: "Sistema de gestão financeira para o restaurante Panela da Roça",
  manifest: "/manifest.json",
  icons: { icon: [{ url: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml" }, { url: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml" }] },
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
