'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Loading } from '@/app/components/Shared'
import toast from 'react-hot-toast'

const INPUT = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const }
const LABEL = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }
const CARD = { background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 14 }

export default function ConfigPage() {
  const { apiGet, apiPost, loading: authLoading } = useAuth()
  const [config, setConfig] = useState<any>(null)
  const [custos, setCustos] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingCustos, setSavingCustos] = useState(false)
  const [aba, setAba] = useState<'limites' | 'custos'>('custos')
  const [mes, setMes] = useState(() => new Date().toISOString().slice(0, 7))
  const [valoresCustos, setValoresCustos] = useState<Record<string, string>>({})

  const carregar = useCallback(async (m: string) => {
    const [conf, cust] = await Promise.all([apiGet('/api/configuracao'), apiGet(`/api/custos-mensais?mes=${m}`)])
    if (conf) setConfig(conf)
    if (cust && !cust.error) {
      setCustos(cust)
      const v: Record<string, string> = {}
      for (const tipo of cust.tipos || []) v[tipo] = cust.valores?.[tipo] ? String(cust.valores[tipo]) : ''
      setValoresCustos(v)
    }
  }, [apiGet])

  useEffect(() => {
    if (authLoading) return
    carregar(mes).finally(() => setLoading(false))
  }, [authLoading, mes, carregar])

  function setValor(tipo: string, val: string) {
    setValoresCustos(p => ({ ...p, [tipo]: val }))
  }

  async function salvarCustos() {
    setSavingCustos(true)
    const valores: Record<string, number> = {}
    for (const [tipo, str] of Object.entries(valoresCustos)) {
      const n = parseFloat(String(str).replace(',', '.'))
      if (!isNaN(n) && n > 0) valores[tipo] = n
    }
    const res = await apiPost('/api/custos-mensais', { mes, valores })
    if (res?.error) toast.error('Erro ao salvar')
    else { toast.success('Custos de ' + mes + ' salvos!'); await carregar(mes) }
    setSavingCustos(false)
  }

  async function salvarLimites() {
    setSaving(true)
    const { tolerancia_caixa, meta_diaria_vendas } = {
      tolerancia_caixa: parseFloat(config?.tolerancia_caixa) || 0,
      meta_diaria_vendas: parseFloat(config?.meta_diaria_vendas) || 0,
    }
    const res = await apiPost('/api/configuracao', { ...config, tolerancia_caixa, meta_diaria_vendas })
    if (res?.id) { toast.success('Configurações salvas!'); setConfig(res) }
    else toast.error('Erro ao salvar')
    setSaving(false)
  }

  if (authLoading || loading) return <Loading />

  const tiposCusto = (custos?.tipos || []).map((t: string) => ({ tipo: t, label: custos.labels[t] }))
  const totalMes = tiposCusto.reduce((s: number, t: any) => s + (parseFloat(valoresCustos[t.tipo]) || 0), 0)
  const diasMes = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate()
  const custoDiario = diasMes > 0 ? totalMes / diasMes : 0

  const mesLabel = new Date(mes + '-01T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return <>
    <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
      {([['custos', '💰 Custos do Mês'], ['limites', '🎯 Limites & Alertas']] as const).map(([k, lab]) => (
        <button key={k} onClick={() => setAba(k)}
          style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: aba === k ? 'var(--accent)' : 'var(--surface)', color: aba === k ? 'var(--bg)' : 'var(--muted)' }}>
          {lab}
        </button>
      ))}
    </div>

    {aba === 'custos' && <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <button onClick={() => setMes(m => mudarMes(m, -1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--fg)' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 600, textTransform: 'capitalize' }}>{mesLabel}</div>
        <button onClick={() => setMes(m => mudarMes(m, +1))} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer', color: 'var(--fg)' }}>›</button>
      </div>

      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>💰 Custos do Mês</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Esses valores variam mês a mês (luz, água, gás, impostos...). Preencha o real de cada mês.</div>
        {tiposCusto.map(((t: any) => (
          <div key={t.tipo} style={{ marginBottom: 10 }}>
            <label style={LABEL}>{t.label}</label>
            <input type="number" step="0.01" placeholder="0,00" value={valoresCustos[t.tipo] || ''}
              onChange={e => setValor(t.tipo, e.target.value)} style={INPUT} />
          </div>
        )))}
        <div style={{ background: 'var(--bg)', borderRadius: 8, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
            <span>Total do mês</span><span style={{ fontWeight: 700, color: 'var(--accent)' }}>{fmtCurrency(totalMes)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)' }}>
            <span>Custo diário ({diasMes} dias)</span><span>{fmtCurrency(custoDiario)}</span>
          </div>
        </div>
        {config?.nome_restaurante && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
          {config.nome_restaurante} · Custo fixo mensal cadastrado: {fmtCurrency((config.aluguel_mensal||0)+(config.funcionarios_mensal||0)+(config.energia_mensal||0)+(config.agua_mensal||0)+(config.outros_fixos||0))}
        </div>}
        <button onClick={salvarCustos} disabled={savingCustos} style={{ width: '100%', height: 46, marginTop: 10, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: savingCustos ? 0.5 : 1 }}>
          {savingCustos ? 'Salvando...' : '✅ Salvar Custos de ' + mes}
        </button>
      </div>
    </>}

    {aba === 'limites' && <>
      <div style={CARD}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🎯 Limites & Alertas</div>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Usados no dashboard e fechamento.</div>
        <div style={{ marginBottom: 10 }}>
          <label style={LABEL}>🎯 Meta diária de vendas (R$)</label>
          <input type="number" step="0.01" value={config?.meta_diaria_vendas || ''} onChange={e => setConfig({ ...config, meta_diaria_vendas: e.target.value })} placeholder="0,00" style={INPUT} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>O dashboard mostra o % de cumprimento.</div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={LABEL}>💵 Tolerância de caixa (R$)</label>
          <input type="number" step="0.01" value={config?.tolerancia_caixa || ''} onChange={e => setConfig({ ...config, tolerancia_caixa: e.target.value })} placeholder="10" style={INPUT} />
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Margem de erro aceita ao conferir o caixa no fechamento.</div>
        </div>
        <button onClick={salvarLimites} disabled={saving} style={{ width: '100%', height: 46, marginTop: 6, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}>
          {saving ? 'Salvando...' : '✅ Salvar Configurações'}
        </button>
      </div>
    </>}
  </>
}

function mudarMes(m: string, delta: number) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 1 + delta, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function Spinner() { return <Loading /> }