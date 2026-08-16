'use client'
import { useEffect } from 'react'

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const token = localStorage.getItem('panela_token')
    if (!token) {
      window.location.href = '/login.html'
    } else {
      document.cookie = 'panela_token=' + token + '; path=/; max-age=86400'
    }
  }, [])
  return <>{children}</>
}
