'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { Modal } from './Shared'

const Principais = [
  { href: '/dashboard', icon: '🏠', label: 'Home' },
  { href: '/fechamento', icon: '💹', label: 'Fluxo' },
  { href: '/churrasco', icon: '🥩', label: 'Churrasco' },
  { href: '/lancamentos', icon: '📋', label: 'Entradas' },
  { href: '/despesas', icon: '💸', label: 'Despesas' },
]

const Demais = [
  { href: '/funcionarios', icon: '👥', label: 'Funcionários', sub: 'Salários e pagamentos' },
  { href: '/contas-a-pagar', icon: '📅', label: 'Contas a Pagar', sub: 'Boletos e vencimentos' },
  { href: '/novo-lancamento', icon: '➕', label: 'Novo Lançamento', sub: 'Registrar compra / venda' },
  { href: '/configuracoes', icon: '⚙️', label: 'Configurações', sub: 'Custos, metas e alertas' },
]

export default function TabBar() {
  const path = usePathname()
  const [aberto, setAberto] = useState(false)

  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(href))
  const demaisAtivo = Demais.some(d => isActive(d.href))

  return (
    <>
      <nav style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 'min(100%, 560px)',
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        padding: '8px 10px max(8px, env(safe-area-inset-bottom))',
        zIndex: 100,
        display: 'flex',
        justifyContent: 'space-around',
      }}>
        {Principais.map(t => {
          const active = isActive(t.href)
          return (
            <Link key={t.href} href={t.href} aria-label={t.label} style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 5, padding: '6px 4px', textDecoration: 'none', borderRadius: 10, position: 'relative',
              color: active ? 'var(--accent)' : 'var(--muted)',
              fontSize: 10, fontWeight: 510, transition: 'color 0.2s, background 0.2s',
              background: active ? 'oklch(62% 0.14 45 / 0.12)' : 'transparent',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 40, height: 30, borderRadius: 10,
                background: active ? 'oklch(62% 0.14 45 / 0.18)' : 'transparent',
                fontSize: 20, transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1)',
                transform: active ? 'translateY(-1px)' : 'none'
              }}>{t.icon}</div>
              <span>{t.label}</span>
            </Link>
          )
        })}

        <button onClick={() => setAberto(true)} aria-label="Mais opções" style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 5, padding: '6px 4px', background: 'transparent', border: 'none', minWidth: 0, cursor: 'pointer',
          fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 510, borderRadius: 10,
          color: demaisAtivo ? 'var(--accent)' : 'var(--muted)',
          backgroundColor: demaisAtivo ? 'oklch(62% 0.14 45 / 0.12)' : 'transparent',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 30, borderRadius: 10, fontSize: 20 }}>⋯</div>
          <span>Mais</span>
        </button>
      </nav>

      {aberto && (
        <Modal titulo="Todas as opções" onClose={() => setAberto(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {Demais.map(d => {
              const active = isActive(d.href)
              return (
                <Link key={d.href} href={d.href} onClick={() => setAberto(false)} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px', borderRadius: 12, textDecoration: 'none',
                  background: active ? 'oklch(62% 0.14 45 / 0.14)' : 'var(--bg)',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                }}>
                  <div style={{ fontSize: 22 }}>{d.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 14 }}>{d.label}</div>
                    {d.sub && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{d.sub}</div>}
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: 18 }}>›</span>
                </Link>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )
}