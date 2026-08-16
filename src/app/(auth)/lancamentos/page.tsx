'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Loading, EmptyState, Modal, CategoryPicker } from '@/app/components/Shared'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { NotebookText, BarChart3, X, ChevronRight, Plus, Pencil, Trash2, Clock } from 'lucide-react'

const CORES = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#7f8c8d']

function hojeBR() { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().slice(0, 10) }

type Periodo = 'hoje' | 'semana' | 'mes' | 'mesAnterior' | 'custom'

function LancamentosInner() {
  const router = useRouter()
  const qc = useQueryClient()
  const searchParams = useSearchParams()
  const categoriaUrl = searchParams.get('categoria') || ''
  const { loading: authLoading, apiGet, apiDelete, apiPut } = useAuth()
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [mes, setMes] = useState(new Date().toISOString().slice(0, 7))
  const [customIni, setCustomIni] = useState(hojeBR().slice(0, 8) + '01')
  const [customFim, setCustomFim] = useState(hojeBR())
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>(categoriaUrl ? { [categoriaUrl]: true } : {})
  const [categorias, setCategorias] = useState<any[]>([])
  const [editando, setEditando] = useState<any>(null)
  const [editDesc, setEditDesc] = useState('')
  const [editValor, setEditValor] = useState('')
  const [editCat, setEditCat] = useState('')
  const [editData, setEditData] = useState('')

  useEffect(() => {
    if (authLoading) return
    apiGet('/api/categorias').then((c: any) => { if (c) setCategorias(c) })
  }, [authLoading])

  const meses = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i); meses.push(d.toISOString().slice(0, 7))
  }

  function calcRange(): { inicio: string; fim: string } {
    if (periodo === 'hoje') { const h = hojeBR(); return { inicio: h, fim: h } }
    if (periodo === 'semana') {
      const d = new Date(); d.setHours(d.getHours() - 3)
      const dow = (d.getDay() + 6) % 7
      const seg = new Date(d); seg.setDate(d.getDate() - dow)
      const dom = new Date(seg); dom.setDate(seg.getDate() + 6)
      return { inicio: seg.toISOString().slice(0, 10), fim: dom.toISOString().slice(0, 10) }
    }
    if (periodo === 'mesAnterior') {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1)
      const y = d.getFullYear(), m = d.getMonth()
      const ult = new Date(y, m + 1, 0).getDate()
      return { inicio: `${y}-${String(m + 1).padStart(2, '0')}-01`, fim: `${y}-${String(m + 1).padStart(2, '0')}-${String(ult).padStart(2, '0')}` }
    }
    if (periodo === 'custom') return { inicio: customIni, fim: customFim }
    const [ano, mesNum] = mes.split('-').map(Number)
    const ultimoDia = new Date(ano, mesNum, 0).getDate()
    return { inicio: mes + '-01', fim: mes + '-' + String(ultimoDia).padStart(2, '0') }
  }

  const { inicio, fim } = calcRange()
  let url = `/api/lancamentos?data_inicio=${inicio}&data_fim=${fim}&limit=500`
  if (categoriaUrl) url += `&categoria=${encodeURIComponent(categoriaUrl)}`

  const { data: lancamentos, isLoading } = useQuery({
    queryKey: ['lancamentos', periodo, mes, customIni, customFim, categoriaUrl],
    queryFn: () => apiGet(url),
    enabled: !authLoading,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiDelete(`/api/lancamentos/${id}`)
      if (res?.error) throw new Error(res.error)
    },
    onSuccess: () => { toast.success('Lançamento excluído'); qc.invalidateQueries({ queryKey: ['lancamentos'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
      const res = await apiPut(`/api/lancamentos/${id}`, payload)
      if (res?.error) throw new Error(res.error)
    },
    onSuccess: () => { toast.success('Lançamento atualizado'); qc.invalidateQueries({ queryKey: ['lancamentos'] }); setEditando(null) },
    onError: (e: Error) => toast.error(e.message),
  })

  function abrirEdicao(l: any) {
    setEditando(l)
    setEditDesc(l.descricao || '')
    setEditValor(String(l.valor || 0))
    setEditCat(l.categoria_id || '')
    setEditData(l.data || '')
  }

  function salvarEdicao() {
    if (!editando) return
    editMutation.mutate({
      id: editando.id,
      payload: { descricao: editDesc, valor: parseFloat(editValor) || 0, categoria_id: editCat || null, data: editData },
    })
  }

  const lista = lancamentos?.data || []
  const totalRec = lista.reduce((s: number, l: any) => s + (l.tipo === 'receita' ? parseFloat(l.valor || 0) : 0), 0)
  const totalDesp = lista.reduce((s: number, l: any) => s + (l.tipo === 'despesa' ? parseFloat(l.valor || 0) : 0), 0)
  const lucroPeriodo = totalRec - totalDesp

  const cats: Record<string, any[]> = {}
  for (const l of lista) {
    const cn = l.categoria_nome || 'Sem categoria'
    if (!cats[cn]) cats[cn] = []
    cats[cn].push(l)
  }
  const agrupados = Object.entries(cats).map(([categoria, itens]) => ({
    categoria, itens,
    total: itens.reduce((s: number, i: any) => s + parseFloat(i.valor || 0), 0),
    percentual: totalDesp > 0 ? Math.round(itens.reduce((s: number, i: any) => s + parseFloat(i.valor || 0), 0) / totalDesp * 100) : 0,
  })).sort((a, b) => b.total - a.total)

  if (authLoading || isLoading) return <Loading />

  return <>
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><NotebookText aria-hidden="true" size={15} color="var(--muted)" /> Lançamentos</span>
        <select value={periodo} onChange={e => setPeriodo(e.target.value as Periodo)} className="form-select" style={{ marginLeft: 'auto', fontSize: 12 }}>
          <option value="hoje">Hoje</option>
          <option value="semana">Esta semana</option>
          <option value="mes">Este mês</option>
          <option value="mesAnterior">Mês passado</option>
          <option value="custom">Customizado</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {periodo === 'mes' && <select value={mes} onChange={e => setMes(e.target.value)} className="form-select" style={{ fontSize: 12 }}>
          {meses.map(m => <option key={m} value={m}>{m}</option>)}
        </select>}
        {periodo === 'custom' && <>
          <input type="date" value={customIni} onChange={e => setCustomIni(e.target.value)} className="form-input" style={{ fontSize: 12, flex: 1, padding: 6 }} />
          <input type="date" value={customFim} onChange={e => setCustomFim(e.target.value)} className="form-input" style={{ fontSize: 12, flex: 1, padding: 6 }} />
        </>}
        <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>{inicio} a {fim}</span>
      </div>
    </div>

    {categoriaUrl && <div className="insight-card" style={{ fontSize: 12, marginBottom: 8 }}>
      Filtrando por: <strong>{categoriaUrl}</strong>
      <button onClick={() => router.push('/lancamentos')} style={{ marginLeft: 8, background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 11 }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><X aria-hidden="true" size={11} /> Limpar</span></button>
    </div>}

    <div className="summary-grid" style={{ marginBottom: 12 }}>
      <div className="summary-card"><div className="summary-sub">Receitas</div><div className="summary-value verde">{fmtCurrency(totalRec)}</div></div>
      <div className="summary-card"><div className="summary-sub">Despesas</div><div className="summary-value vermelho">{fmtCurrency(totalDesp)}</div></div>
      <div className="summary-card"><div className="summary-sub">Resultado</div><div className={`summary-value ${lucroPeriodo >= 0 ? 'verde' : 'vermelho'}`}>{fmtCurrency(lucroPeriodo)}</div></div>
    </div>

    {agrupados.length > 0 && <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, border: '1px solid var(--border)', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Distribuição por Categoria</div>
      <ResponsiveContainer width="100%" height={120}>
        <PieChart>
          <Pie data={agrupados} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
            {agrupados.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
          </Pie>
          <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} />
        </PieChart>
      </ResponsiveContainer>
    </div>}

    {agrupados.length === 0 ? <EmptyState msg="Nenhum lançamento neste período" /> : agrupados.map(g => {
      const isExp = expandidos[g.categoria] || false
      return <div key={g.categoria} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 8, overflow: 'hidden' }}>
        <div onClick={() => setExpandidos(prev => ({ ...prev, [g.categoria]: !prev[g.categoria] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer' }}>
          <span style={{ fontSize: 12, transform: isExp ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', display: 'inline-flex' }}><ChevronRight aria-hidden="true" size={12} /></span>
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{g.categoria}</span>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>{g.percentual}%</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--vermelho)' }}>{fmtCurrency(g.total)}</span>
          <button onClick={(e) => { e.stopPropagation(); router.push(`/novo-lancamento?categoria=${encodeURIComponent(g.categoria)}`) }} aria-label="Novo lançamento nesta categoria" style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 16, cursor: 'pointer' }}><Plus aria-hidden="true" size={16} /></button>
        </div>
        {isExp && <div style={{ borderTop: '1px solid var(--border)', padding: '6px 12px' }}>
          {g.itens.map((item: any) => <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13 }}>{item.descricao || 'Sem descrição'}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>{item.data}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>{fmtCurrency(item.valor)}</span>
              <button onClick={() => abrirEdicao(item)} title="Editar" aria-label="Editar" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}><Pencil aria-hidden="true" size={12} /></button>
              <button onClick={() => { if (confirm('Excluir este lançamento?')) deleteMutation.mutate(item.id) }} title="Excluir" aria-label="Excluir" style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}><Trash2 aria-hidden="true" size={12} /></button>
            </div>
          </div>)}
        </div>}
      </div>
    })}

    <div style={{ display: 'flex', justifyContent: 'space-between', padding: 12, background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--accent)', marginTop: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>Resultado do período</span>
      <span style={{ fontWeight: 700, fontSize: 16, color: lucroPeriodo >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(lucroPeriodo)}</span>
    </div>

    <button onClick={() => router.push('/novo-lancamento')} className="fab" style={{ bottom: 80, right: 20 }} aria-label="Novo lançamento">+</button>

    {editando && (
      <Modal titulo="Editar Lançamento" onClose={() => setEditando(null)}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Descrição</label>
            <input className="form-input" value={editDesc} onChange={e => setEditDesc(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>Valor (R$)</label>
              <input className="form-input" type="number" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} style={{ marginTop: 2 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>Data</label>
              <input className="form-input" type="date" value={editData} onChange={e => setEditData(e.target.value)} style={{ marginTop: 2 }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Categoria</label>
            <div style={{ marginTop: 2 }}>
              <CategoryPicker categorias={categorias} value={editCat} onChange={setEditCat} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={() => setEditando(null)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={salvarEdicao} disabled={editMutation.isPending} className="btn btn-primary" style={{ flex: 2 }}>{editMutation.isPending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock aria-hidden="true" size={15} /> ...</span> : 'Salvar'}</button>
          </div>
        </div>
      </Modal>
    )}
  </>
}

export default function LancamentosPage() {
  return <Suspense fallback={<Loading />}>
    <LancamentosInner />
  </Suspense>
}
