'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import {
  Home, TrendingUp, Beef, NotebookText, Banknote, Users,
  CalendarClock, NotebookPen, Settings, MoreHorizontal, ChevronRight,
} from 'lucide-react'
import { Modal } from './Shared'

const Principais = [
  { href: '/dashboard', Icon: Home, label: 'Home' },
  { href: '/fechamento', Icon: TrendingUp, label: 'Fluxo' },
  { href: '/churrasco', Icon: Beef, label: 'Churrasco' },
  { href: '/lancamentos', Icon: NotebookText, label: 'Entradas' },
  { href: '/despesas', Icon: Banknote, label: 'Despesas' },
]

const Demais = [
  { href: '/funcionarios', Icon: Users, label: 'Funcionários', sub: 'Salários e pagamentos' },
  { href: '/contas-a-pagar', Icon: CalendarClock, label: 'Contas a Pagar', sub: 'Boletos e vencimentos' },
  { href: '/novo-lancamento', Icon: NotebookPen, label: 'Novo Lançamento', sub: 'Registrar compra / venda' },
  { href: '/configuracoes', Icon: Settings, label: 'Configurações', sub: 'Custos, metas e alertas' },
]

const iconProps = (ativo: boolean) => ({
  size: 20,
  strokeWidth: 2.1,
  'aria-hidden': true as const,
  style: { color: ativo ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.2s' },
})

export default function TabBar() {
  const path = usePathname()
  const [aberto, setAberto] = useState(false)

  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(href))
  const demaisAtivo = Demais.some(d => isActive(d.href))

  return (
    <>
      <nav className="tabbar" style={{
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
                transition: 'transform 0.2s cubic-bezier(0.16,1,0.3,1), background 0.2s',
                transform: active ? 'translateY(-1px)' : 'none'
              }}>
                <t.Icon {...iconProps(active)} />
              </div>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 30, borderRadius: 10 }}>
            <MoreHorizontal {...iconProps(false)} size={22} />
          </div>
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
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: active ? 'oklch(62% 0.14 45 / 0.18)' : 'var(--surface)',
                  }}>
                    <d.Icon {...iconProps(active)} size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--fg)', fontWeight: 600, fontSize: 14 }}>{d.label}</div>
                    {d.sub && <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 1 }}>{d.sub}</div>}
                  </div>
                  <ChevronRight aria-hidden="true" style={{ color: 'var(--accent)' }} size={18} />
                </Link>
              )
            })}
          </div>
        </Modal>
      )}
    </>
  )
}