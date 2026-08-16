'use client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [qc] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: 2,
        refetchOnWindowFocus: true,
      },
    },
  }))
  return (
    <QueryClientProvider client={qc}>
      {children}
      <Toaster position="top-center" toastOptions={{
        style: { background: 'var(--surface)', color: 'var(--fg)', border: '1px solid var(--border)', fontSize: 13 },
        success: { iconTheme: { primary: 'oklch(55% 0.10 140)', secondary: 'var(--fg)' } },
        error: { iconTheme: { primary: 'oklch(48% 0.16 28)', secondary: 'var(--fg)' } },
      }} />
    </QueryClientProvider>
  )
}
