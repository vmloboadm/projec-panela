'use client'
import { useState } from 'react'

export function Loading() {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
      <div>Carregando...</div>
    </div>
  )
}

export function Modal({ titulo, onClose, children, fullHeight }: {
  titulo: string
  onClose: () => void
  children: React.ReactNode
  fullHeight?: boolean
}) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 300 }} />
      <div style={{
        position: 'fixed',
        left: 0, right: 0, bottom: 0,
        margin: '0 auto',
        width: '100%',
        maxWidth: 520,
        zIndex: 301,
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        border: '1px solid var(--border)',
        borderBottom: 'none',
        boxShadow: '0 -8px 30px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: fullHeight ? '92vh' : '82vh',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{titulo}</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--muted)', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: 16, flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {children}
        </div>
      </div>
    </>
  )
}

export function EmptyState({ msg, cta }: { msg?: string; cta?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>📋</div>
      <div style={{ fontSize: 15, marginBottom: 16 }}>{msg || 'Nenhum dado encontrado'}</div>
      {cta && <div dangerouslySetInnerHTML={{ __html: cta }} />}
    </div>
  )
}

const CORES_CAT = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#7f8c8d', '#16a085', '#c0392b']

export function CategoryPicker({ categorias, value, onChange, filter }: {
  categorias: any[]
  value: string
  onChange: (id: string) => void
  filter?: (c: any) => boolean
}) {
  const [busca, setBusca] = useState('')
  const lista = categorias.filter(f => f && (filter ? filter(f) : true))
  const agrupadas: Record<string, any[]> = {}
  for (const l of lista) {
    const tipo = l.tipo === 'receita' ? '💰 Receitas' : '🔥 Despesas'
    if (!agrupadas[tipo]) agrupadas[tipo] = []
    agrupadas[tipo].push(l)
  }
  const grupos = Object.entries(agrupadas)
  const selecionada = categorias.find((c: any) => c.id === value)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <select className="form-select" value={value} onChange={e => onChange(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
        <option value="">📂 Categoria</option>
        {grupos.map(([tipo, cats]) => (
          <optgroup key={tipo} label={tipo}>
            {cats.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </optgroup>
        ))}
      </select>
      {selecionada && <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--accent)', whiteSpace: 'nowrap' }}>{selecionada.nome}</span>}
    </div>
  )
}
