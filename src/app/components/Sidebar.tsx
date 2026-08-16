'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home, TrendingUp, Beef, NotebookText, Banknote, Users,
  CalendarClock, NotebookPen, Settings, Flame,
} from 'lucide-react'

const Itens = [
  { href: '/dashboard', Icon: Home, label: 'Home', sub: 'Painel do restaurante' },
  { href: '/fechamento', Icon: TrendingUp, label: 'Fluxo', sub: 'Fechamento e caixa' },
  { href: '/churrasco', Icon: Flame, label: 'Churrasco', sub: 'Carnes e estoque' },
  { href: '/lancamentos', Icon: NotebookText, label: 'Entradas', sub: 'Todas as entradas' },
  { href: '/despesas', Icon: Banknote, label: 'Despesas', sub: 'Todas as despesas' },
  { href: '/funcionarios', Icon: Users, label: 'Funcionários', sub: 'Salários e pagamentos' },
  { href: '/contas-a-pagar', Icon: CalendarClock, label: 'Contas a Pagar', sub: 'Boletos e vencimentos' },
  { href: '/novo-lancamento', Icon: NotebookPen, label: 'Novo Lançamento', sub: 'Registrar venda / compra' },
  { href: '/configuracoes', Icon: Settings, label: 'Configurações', sub: 'Custos, metas e alertas' },
]

export default function Sidebar() {
  const path = usePathname()
  const isActive = (href: string) => path === href || (href !== '/' && path.startsWith(href))

  return (
    <nav className="sidebar" aria-label="Navegação principal">
      <div className="sidebar-brand">
        <img src="/logo-panela-png.png" alt="Panela da Roça" className="sidebar-logo" />
        <div>
          <div className="sidebar-titulo">Panela da Roça</div>
          <div className="sidebar-sub">Gestão Financeira</div>
        </div>
      </div>
      <div className="sidebar-links">
        {Itens.map(t => {
          const active = isActive(t.href)
          return (
            <Link key={t.href} href={t.href} aria-label={t.label} className={`sidebar-link${active ? ' active' : ''}`}>
              <span className="sidebar-icon">
                <t.Icon
                  aria-hidden="true"
                  size={18}
                  strokeWidth={2.1}
                  style={{ color: active ? 'var(--accent)' : 'var(--muted)', transition: 'color 0.2s' }}
                />
              </span>
              <span className="sidebar-texto">
                <span className="sidebar-label">{t.label}</span>
                <span className="sidebar-sub">{t.sub}</span>
              </span>
            </Link>
          )
        })}
      </div>
      <div className="sidebar-footer">
        <span style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, display: 'block' }}>
          Panela da Roça · Guarus
        </span>
      </div>
    </nav>
  )
}