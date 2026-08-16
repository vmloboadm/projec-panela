'use client'
import { useRouter } from 'next/navigation'
import AuthGuard from '@/app/components/AuthGuard'
import PinLock from '@/app/components/PinLock'
import TabBar from '@/app/components/TabBar'
import Sidebar from '@/app/components/Sidebar'
import { Settings, User, LogOut } from 'lucide-react'
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
        <div className="layout layout-shell">
          <Sidebar />
          <header className="header">
            <img src="/logo-panela-png.png" alt="Panela da Roça" className="header-logo" />
            <div className="header-titulo" style={{ cursor: 'pointer', minWidth: 0 }} onClick={() => router.push('/dashboard')}>
              <strong style={{ display: 'block' }}>{nome}</strong>
              <div className="date">{dateStr}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', position: 'relative' }}>
              <button aria-label="Configurações" onClick={() => router.push('/configuracoes')}
                style={{ width: 40, height: 40, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.2s, border-color 0.2s' }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)' }}>
                <Settings aria-hidden="true" size={17} />
              </button>
              <div className="user-menu" onClick={() => setMenuAberto(v => !v)} style={{ cursor: 'pointer' }}>
                <User aria-hidden="true" size={18} />
              </div>
              {menuAberto && (
                <div style={{ position: 'absolute', top: 44, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,.4)', padding: 6, zIndex: 200, minWidth: 180 }}>
                  <div style={{ padding: '8px 10px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>Admin</div>
                  <button onClick={() => ir('/configuracoes')} className="menu-item">
                    <Settings aria-hidden="true" size={14} style={{ color: 'var(--muted)' }} /> Configurações
                  </button>
                  <button onClick={sair} className="menu-item" style={{ color: 'var(--vermelho)' }}>
                    <LogOut aria-hidden="true" size={14} /> Sair
                  </button>
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