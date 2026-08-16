'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Loading, EmptyState } from '@/app/components/Shared'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'

const CORES = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#7f8c8d', '#95a5a6', '#16a085']

function hojeBR() { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().slice(0, 10) }

export default function DespesasPage() {
  const router = useRouter()
  const { loading: authLoading, apiGet } = useAuth()
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [periodo, setPeriodo] = useState<'mes' | 'mesAnterior' | 'ano' | 'hoje'>('mes')
  const [search, setSearch] = useState('')
  const [catFiltro, setCatFiltro] = useState('')
  const [dados, setDados] = useState<any>(null)
  const [lista, setLista] = useState<any[]>([])
  const [carregando, setCarregando] = useState(false)

  const meses = useMemo(() => {
    const arr = []
    for (let i = 0; i < 12; i++) { const d = new Date(); d.setMonth(d.getMonth() - i); arr.push(d.toISOString().slice(0, 7)) }
    return arr
  }, [])

  function calcRange(): { ini: string; fim: string } {
    if (periodo === 'hoje') { const h = hojeBR(); return { ini: h, fim: h } }
    if (periodo === 'mesAnterior') {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
      const y = d.getFullYear(), m = d.getMonth()
      return { ini: `${y}-${String(m + 1).padStart(2, '0')}-01`, fim: `${y}-${String(m + 1).padStart(2, '0')}-${String(new Date(y, m + 1, 0).getDate()).padStart(2, '0')}` }
    }
    if (periodo === 'ano') return { ini: mes.slice(0, 4) + '-01-01', fim: new Date().toISOString().slice(0, 10) }
    const [ano, mesNum] = mes.split('-').map(Number)
    return { ini: mes + '-01', fim: mes + '-' + String(new Date(ano, mesNum, 0).getDate()).padStart(2, '0') }
  }

  useEffect(() => {
    if (authLoading) return
    let ativo = true
    async function carregar() {
      setCarregando(true)
      const { ini, fim } = calcRange()
      const [res, listaRes] = await Promise.all([
        apiGet(`/api/despesas/resumo?data_inicio=${ini}&data_fim=${fim}`),
        apiGet(`/api/despesas?data_inicio=${ini}&data_fim=${fim}&limit=1000`),
      ])
      if (!ativo) return
      setDados(res)
      setLista(listaRes?.data || [])
      setCarregando(false)
    }
    carregar()
    return () => { ativo = false }
  }, [authLoading, mes, periodo])

  const totalPeriodo = dados?.total || 0
  const maiorCat = dados?.maiorCategoria
  const totalLanc = dados?.totalLancamentos || 0

  const listaFiltrada = useMemo(() => {
    let arr = lista
    if (catFiltro) arr = arr.filter(l => l.categoria_nome === catFiltro)
    if (search.trim()) {
      const q = search.toLowerCase()
      arr = arr.filter(l => (l.descricao || '').toLowerCase().includes(q))
    }
    return arr
  }, [lista, catFiltro, search])

  if (authLoading && !dados) return <Loading />

  return <>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 700, fontSize: 15 }}>💸 Despesas</span>
      <select value={periodo} onChange={e => setPeriodo(e.target.value as any)} className="form-select" style={{ marginLeft: 'auto', fontSize: 12 }}>
        <option value="mes">Este mês</option>
        <option value="mesAnterior">Mês passado</option>
        <option value="ano">Ano</option>
        <option value="hoje">Hoje</option>
      </select>
      {periodo === 'mes' && <select value={mes} onChange={e => setMes(e.target.value)} className="form-select" style={{ fontSize: 12 }}>
        {meses.map(m => <option key={m} value={m}>{m}</option>)}
      </select>}
    </div>

    <div className="summary-grid" style={{ marginBottom: 12 }}>
      <div className="summary-card">
        <div className="summary-sub">Total Despesas</div>
        <div className="summary-value vermelho">{fmtCurrency(totalPeriodo)}</div>
      </div>
      <div className="summary-card">
        <div className="summary-sub">Lançamentos</div>
        <div className="summary-value">{totalLanc}</div>
      </div>
      <div className="summary-card">
        <div className="summary-sub">Ticket médio</div>
        <div className="summary-value">{totalLanc > 0 ? fmtCurrency(totalPeriodo / totalLanc) : fmtCurrency(0)}</div>
      </div>
    </div>

    {maiorCat && <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--accent)', padding: '10px 12px', marginBottom: 12, fontSize: 12 }}>
      🔥 Maior categoria: <strong>{maiorCat.nome}</strong> — {fmtCurrency(maiorCat.total)} ({maiorCat.percentual}%)
    </div>}

    {dados?.porDia && dados.porDia.length > 0 && (
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>📈 Evolução diária de despesas</div>
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={dados.porDia}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="dia" tick={{ fontSize: 9, fill: 'var(--muted)' }} tickFormatter={(d: string) => d.slice(5, 10)} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} width={40} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : `${v}`} />
            <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,.3)' }} />
            <Line type="monotone" dataKey="total" stroke="var(--vermelho)" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    )}

    {dados?.categorias && dados.categorias.length > 0 && (
      <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>📊 Despesas por categoria — {fmtCurrency(totalPeriodo)}</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dados.categorias}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="nome" tick={{ fontSize: 8, fill: 'var(--muted)' }} />
            <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} width={40} tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}k` : `${v}`} />
            <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} cursor={{ fill: 'var(--border)', opacity: 0.15 }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,.3)' }} />
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={22}>
              {dados.categorias.map((_: any, i: number) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div style={{ display: 'grid', gap: 4, marginTop: 8 }}>
          {dados.categorias.map((c: any, i: number) => (
            <div key={c.nome} onClick={() => setCatFiltro(catFiltro === c.nome ? '' : c.nome)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: CORES[i % CORES.length], flex: 'none' }} />
              <span style={{ flex: 1, fontSize: 12 }}>{c.nome}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>{c.lancamentos}x</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vermelho)' }}>{fmtCurrency(c.total)}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', width: 40, textAlign: 'right' }}>{c.percentual}%</span>
            </div>
          ))}
        </div>
      </div>
    )}

    <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>🏆 Top lançamentos</div>
      {dados?.topItens && dados.topItens.length > 0 ? dados.topItens.map((t: any, i: number) => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 11, color: 'var(--muted)', width: 16 }}>{i + 1}º</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12 }}>{t.descricao}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>{t.categoria} • {t.data}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--vermelho)' }}>{fmtCurrency(t.valor)}</span>
        </div>
      )) : <div style={{ fontSize: 12, color: 'var(--muted)' }}>Sem dados</div>}
    </div>

    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
      <input className="form-input" placeholder="🔍 Buscar lançamento..." value={search} onChange={e => setSearch(e.target.value)} style={{ fontSize: 12, flex: 2 }} />
      <select className="form-select" value={catFiltro} onChange={e => setCatFiltro(e.target.value)} style={{ fontSize: 12, flex: 1 }}>
        <option value="">Todas categorias</option>
        {(dados?.categorias || []).map((c: any) => <option key={c.nome} value={c.nome}>{c.nome}</option>)}
      </select>
    </div>

    {listaFiltrada.length === 0 ? <EmptyState msg="Nenhuma despesa no período" /> : listaFiltrada.map(l => (
      <div key={l.id} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13 }}>{l.descricao || 'Sem descrição'}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{l.categoria_nome || 'Sem categoria'} • {l.data}</div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--vermelho)' }}>{fmtCurrency(l.valor)}</span>
      </div>
    ))}

    <button onClick={() => router.push('/novo-lancamento')} className="fab" style={{ bottom: 20, right: 20 }} title="Lançar despesa">✚</button>
  </>
}