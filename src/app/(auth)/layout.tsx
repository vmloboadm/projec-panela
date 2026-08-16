'use client'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'
import PinLock from '@/app/components/PinLock'
import TabBar from '@/app/components/TabBar'
import { useEffect, useState } from 'react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [dateStr] = useState(() => new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }))
  const [nome, setNome] = useState('Panela da Roça')
  const [menuAberto, setMenuAberto] = useState(false)

  useEffect(() => {
    const t = localStorage.getItem('panela_token')
    if (!t) return
    fetch('/api/configuracao', { headers: { 'Authorization': 'Bearer ' + t } })
      .then(r => r.json())
      .then(c => { if (c?.nome_restaurante) setNome(c.nome_restaurante) })
      .catch(() => {})
  }, [])

  function ir(p: string) { setMenuAberto(false); router.push(p) }
  function sair() { localStorage.clear(); router.push('/login.html') }

  return (
    <AuthGuard>
      <PinLock>
        <div className="layout">
          <header className="header">
            <div className="header-titulo" style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => router.push('/dashboard')}>
              <strong style={{ display: 'block' }}>{nome}</strong>
              <div className="date">{dateStr}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
              <button aria-label="Configurações" onClick={() => router.push('/configuracoes')}
                style={{ width: 36, height: 36, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--muted)', fontSize: 15 }}>⚙️</button>
              <div className="user-menu" onClick={() => setMenuAberto(v => !v)}>👤</div>
              {menuAberto && (
                <div style={{ position: 'absolute', top: 44, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: 6, zIndex: 200, minWidth: 180 }}>
                  <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Admin</div>
                  <button onClick={() => ir('/configuracoes')} className="menu-item">⚙️ Configurações</button>
                  <button onClick={sair} className="menu-item" style={{ color: 'var(--vermelho)' }}>🚪 Sair</button>
                </div>
              )}
            </div>
          </header>
          <main className="main">
            {children}
          </main>
          <TabBar />
        </div>
      </PinLock>
    </AuthGuard>
  )
}