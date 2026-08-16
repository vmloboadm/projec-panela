'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAuth, fmtCurrency, todayStr } from '@/app/components/useAuth'
import { Loading, EmptyState, Modal } from '@/app/components/Shared'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type Conta = {
  id: string
  descricao: string
  valor: number | string
  data_vencimento: string
  status: string
  categoria_id?: string | null
  fornecedor?: string | null
  tipo_documento?: string | null
  observacoes?: string | null
  recorrente?: boolean
  dia_vencimento?: number
  metodo_pagamento?: string | null
  multa?: number | string | null
  juros?: number | string | null
  valor_pago?: number | string | null
  data_pagamento?: string | null
  lancamento_id?: string | null
  ja_lancada?: boolean
  afeta_caixa?: boolean | null
}

const TIPOS_DOC = ['Boleto', 'NFe', 'Duplicata', 'Recibo', 'Outro']
const METODOS = [
  { key: 'dinheiro', label: 'Dinheiro', icon: '💵' },
  { key: 'pix', label: 'Pix', icon: '📱' },
  { key: 'cartao_credito', label: 'Cartão Crédito', icon: '💳' },
  { key: 'cartao_debito', label: 'Cartão Débito', icon: '💳' },
]

function hojeBR() { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().slice(0, 10) }

export default function ContasPage() {
  const router = useRouter()
  const { loading: authLoading, apiGet, apiPost, apiDelete, apiPut, apiUpload } = useAuth()
  const [loading, setLoading] = useState(true)
  const [contas, setContas] = useState<Conta[]>([])
  const [pagas, setPagas] = useState<Conta[]>([])
  const [categorias, setCategorias] = useState<any[]>([])
  const [fornecedores, setFornecedores] = useState<string[]>([])
  const [resumo, setResumo] = useState<any>(null)
  const [aba, setAba] = useState<'pendentes' | 'pagas'>('pendentes')
  const [showModal, setShowModal] = useState(false)
  const [forceUpdate, setForceUpdate] = useState(0)
  const [pagarId, setPagarId] = useState<string | null>(null)

  const [busca, setBusca] = useState('')
  const [filtroFornecedor, setFiltroFornecedor] = useState('')
  const [filtroTipoDoc, setFiltroTipoDoc] = useState('')
  const [mesVisao, setMesVisao] = useState(() => new Date().toISOString().slice(0, 7))

  // formulário
  const [novaDesc, setNovaDesc] = useState('')
  const [novaValor, setNovaValor] = useState('')
  const [novaData, setNovaData] = useState(hojeBR())
  const [novaCategoria, setNovaCategoria] = useState('')
  const [novaFornecedor, setNovaFornecedor] = useState('')
  const [novaTipoDoc, setNovaTipoDoc] = useState('Boleto')
  const [novaObs, setNovaObs] = useState('')
  const [novaRecorrente, setNovaRecorrente] = useState(false)
  const [novaJaLancada, setNovaJaLancada] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [showFornecedores, setShowFornecedores] = useState(false)
  const fornecedorRef = useRef<HTMLInputElement>(null)

  // pagamento
  const [pagandoConta, setPagandoConta] = useState<Conta | null>(null)
  const [pgMetodo, setPgMetodo] = useState('dinheiro')
  const [pgData, setPgData] = useState(hojeBR())
  const [pgMulta, setPgMulta] = useState('')
  const [pgJuros, setPgJuros] = useState('')

  // boleto por foto
  const fotoRef = useRef<HTMLInputElement>(null)
  const [lendoBoleto, setLendoBoleto] = useState(false)

  useEffect(() => {
    if (authLoading) return
    carregar()
  }, [authLoading, forceUpdate, aba, filtroFornecedor, filtroTipoDoc])

  useEffect(() => {
    if (authLoading) return
    apiGet('/api/categorias').then(cats => { if (cats) setCategorias(cats) })
    apiGet('/api/contas-a-pagar?fornecedores=true').then(fs => { if (Array.isArray(fs)) setFornecedores(fs) })
  }, [authLoading])

  useEffect(() => {
    if (authLoading) return
    apiGet(`/api/contas-a-pagar?resumo=true&mes=${mesVisao}`).then(r => { if (r && !r.error) setResumo(r) })
  }, [authLoading, mesVisao, forceUpdate, aba])

  async function carregar() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ mes: mesVisao })
      if (aba === 'pendentes') params.set('status', 'pendente')
      else params.set('status', 'pago')
      if (filtroFornecedor) params.set('fornecedor', filtroFornecedor)
      if (filtroTipoDoc) params.set('tipo_documento', filtroTipoDoc)
      if (busca) params.set('busca', busca)
      const res = await apiGet(`/api/contas-a-pagar?${params.toString()}`)
      if (Array.isArray(res)) {
        if (aba === 'pendentes') setContas(res)
        else setPagas(res)
      }
    } catch (err) { console.error(err) }
    setLoading(false)
  }

  useEffect(() => {
    const t = setTimeout(() => { if (authLoading) return; carregar() }, 300)
    return () => clearTimeout(t)
  }, [busca])

  async function criarConta(payload?: Partial<any>) {
    const p = payload || {
      descricao: novaDesc,
      valor: novaValor,
      data_vencimento: novaData,
      categoria_id: novaCategoria || undefined,
      fornecedor: novaFornecedor || undefined,
      tipo_documento: novaTipoDoc,
      observacoes: novaObs || undefined,
      recorrente: novaRecorrente,
      ja_lancada: novaJaLancada,
    }
    if (!p.descricao || !p.valor) { toast.error('Preencha descrição e valor'); return }
    setSalvando(true)
    try {
      const res = await apiPost('/api/contas-a-pagar', p)
      if (res?.error) throw new Error(res.error)
      toast.success('Conta criada!')
      setShowModal(false); setNovaDesc(''); setNovaValor(''); setNovaCategoria(''); setNovaFornecedor(''); setNovaObs(''); setNovaTipoDoc('Boleto'); setNovaRecorrente(false); setNovaJaLancada(false)
      setForceUpdate(v => v + 1)
    } catch (err: any) { toast.error(err.message || 'Erro ao criar conta') }
    setSalvando(false)
  }

  async function pagarConta(c: Conta) {
    if (!pagandoConta) return
    setPagarId(c.id)
    try {
      const res = await apiPost(`/api/contas-a-pagar/${c.id}/pagar`, {
        descricao: c.descricao,
        valor: c.valor,
        data_pagamento: pgData,
        metodo_pagamento: pgMetodo,
        multa: pgMulta || 0,
        juros: pgJuros || 0,
      })
      if (res?.error) throw new Error(res.error)
      toast.success(`Conta paga via ${METODOS.find(m => m.key === pgMetodo)?.label || pgMetodo}!`)
      setPagandoConta(null); setPgMulta(''); setPgJuros('')
      setForceUpdate(v => v + 1)
    } catch (err: any) { toast.error(err.message || 'Erro ao pagar') }
    setPagarId(null)
  }

  async function pagarRapido(c: Conta) {
    if (!confirm(`Confirmar pagamento de ${fmtCurrency(parseFloat(String(c.valor)) || 0)}?`)) return
    setPagarId(c.id)
    try {
      const res = await apiPost(`/api/contas-a-pagar/${c.id}/pagar`, { descricao: c.descricao, valor: c.valor, data_pagamento: hojeBR() })
      if (res?.error) throw new Error(res.error)
      toast.success('Conta paga!')
      setForceUpdate(v => v + 1)
    } catch (err: any) { toast.error(err.message || 'Erro ao pagar') }
    setPagarId(null)
  }

  async function excluirConta(c: Conta) {
    if (!confirm(`Excluir "${c.descricao}"?`)) return
    try {
      const res = await apiDelete(`/api/contas-a-pagar/${c.id}`)
      if (!res?.error) { toast.success('Conta excluída'); setForceUpdate(v => v + 1) }
    } catch { }
  }

  async function gerarProximoMes(c: Conta) {
    if (!confirm(`Gerar parcela do próximo mês para "${c.descricao}"?`)) return
    try {
      const res = await apiPost(`/api/contas-a-pagar/${c.id}/gerar-proximo-mes`, {})
      if (res?.error) throw new Error(res.error)
      toast.success('Próximo mês gerado!')
      setForceUpdate(v => v + 1)
    } catch (err: any) { toast.error(err.message || 'Erro ao gerar próximo mês') }
  }

  function diasAtraso(c: Conta) {
    const hoje = hojeBR()
    if (c.data_vencimento >= hoje) return 0
    const diff = new Date(hoje).getTime() - new Date(c.data_vencimento).getTime()
    return Math.floor(diff / 86400000)
  }

  function agrupar(lista: Conta[]) {
    const hoje = hojeBR()
    const tresDias = new Date(); tresDias.setHours(tresDias.getHours() - 3); tresDias.setDate(tresDias.getDate() + 3)
    const tresDiasStr = tresDias.toISOString().slice(0, 10)
    const vencidas: Conta[] = [], hojeArr: Conta[] = [], proximos: Conta[] = [], futuro: Conta[] = []
    for (const c of lista) {
      if (c.data_vencimento < hoje) vencidas.push(c)
      else if (c.data_vencimento === hoje) hojeArr.push(c)
      else if (c.data_vencimento <= tresDiasStr) proximos.push(c)
      else futuro.push(c)
    }
    return { vencidas, hoje: hojeArr, proximos, futuro }
  }

  const grupos = agrupar(contas)
  const soma = (l: Conta[]) => l.reduce((s, c) => s + parseFloat(String(c.valor) || '0'), 0)
  const totalPendente = soma(contas)
  const listaAtual = aba === 'pendentes' ? contas : pagas

  const diasDoMes = useMemo(() => {
    const [ano, mes] = mesVisao.split('-').map(Number)
    const total = new Date(ano, mes, 0).getDate()
    const dias: { dia: number; contas: Conta[] }[] = []
    for (let d = 1; d <= total; d++) {
      const ds = `${mesVisao}-${String(d).padStart(2, '0')}`
      dias.push({ dia: d, contas: contas.filter(c => c.data_vencimento === ds) })
    }
    return dias
  }, [mesVisao, contas])

  const contasPorFornecedor = useMemo(() => {
    const map: Record<string, Conta[]> = {}
    for (const c of contas) {
      const f = c.fornecedor || 'Sem fornecedor'
      map[f] = map[f] || []
      map[f].push(c)
    }
    return map
  }, [contas])

  function navegarMes(delta: number) {
    const [ano, mes] = mesVisao.split('-').map(Number)
    const d = new Date(ano, mes - 1 + delta, 1)
    setMesVisao(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const fornecedoresFiltrados = fornecedores.filter(f => f.toLowerCase().includes(novaFornecedor.toLowerCase())).slice(0, 6)

  async function lerBoleto(arquivo: File) {
    setLendoBoleto(true)
    try {
      const fd = new FormData()
      fd.append('arquivo', arquivo)
      const res = await apiUpload('/api/ia/boleto', fd)
      if (res?.error) throw new Error(res.error)
      const s = res?.sugestao
      if (s?.descricao) {
        setShowModal(true)
        setNovaDesc(s.descricao)
        setNovaValor(s.valor ? String(s.valor) : '')
        if (s.data_vencimento) setNovaData(s.data_vencimento)
        if (s.fornecedor) setNovaFornecedor(s.fornecedor)
        if (s.tipo_documento) setNovaTipoDoc(s.tipo_documento)
        if (s.categoria_id) setNovaCategoria(s.categoria_id)
        toast.success('Boleto lido! Confira os dados.')
      } else {
        toast.success('Boleto registrado na fila de pendências.')
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao ler boleto')
    }
    setLendoBoleto(false)
  }

  if (authLoading || loading) return <Loading />

  function renderConta(c: Conta, destaque: boolean) {
    const atraso = diasAtraso(c)
    const fornecedor = c.fornecedor || ''
    const tipoDoc = c.tipo_documento || 'Outro'
    return <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--surface)', borderRadius: 8, border: `1px solid ${destaque ? 'var(--vermelho)' : 'var(--border)'}`, marginBottom: 6, gap: 8 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.descricao}</span>
          {c.recorrente && <span title="Recorrente">🔁</span>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
          {fornecedor && <><strong style={{ color: 'var(--fg)' }}>{fornecedor}</strong> · </>}
          <span style={{ background: 'var(--bg)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>{tipoDoc}</span>
          {' '}· Vence {new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')}
          {atraso > 0 && <span style={{ color: 'var(--vermelho)' }}> ({atraso}d atraso)</span>}
        </div>
        {c.observacoes && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>📝 {c.observacoes}</div>}
        {c.ja_lancada && <div style={{ fontSize: 10, color: 'var(--verde)', marginTop: 2 }}>🧾 Custo já lançado</div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{fmtCurrency(parseFloat(String(c.valor)) || 0)}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {aba === 'pendentes' ? (
            <>
              <button onClick={() => { setPagandoConta(c); setPgData(hojeBR()); setPgMetodo(c.metodo_pagamento || 'dinheiro') }} disabled={pagarId === c.id}
                style={{ padding: '4px 10px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                {pagarId === c.id ? '⏳' : 'PAGAR'}
              </button>
              <button onClick={() => { setPagandoConta(c); setPgMetodo(c.metodo_pagamento || 'dinheiro') }}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontSize: 11, cursor: 'pointer' }} title="Pagamento com método/multa/juros">
                💳
              </button>
              {c.recorrente && <button onClick={() => gerarProximoMes(c)}
                style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', fontSize: 11, cursor: 'pointer' }} title="Gerar próximo mês">
                🔁
              </button>}
            </>
          ) : (
            <>
              <button onClick={() => excluirConta(c)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}>🗑️</button>
            </>
          )}
        </div>
      </div>
    </div>
  }

  return <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--accent)' }}>📄 Contas a Pagar</span>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => fotoRef.current?.click()} disabled={lendoBoleto}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {lendoBoleto ? '⏳' : '📸 Boleto'}
        </button>
        <input ref={fotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) lerBoleto(f); e.target.value = '' }} />
        <button onClick={() => setShowModal(true)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--bg)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>➕ Nova</button>
      </div>
    </div>

    {/* Navegação de mês */}
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
      <button onClick={() => navegarMes(-1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>◀</button>
      <div style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 13 }}>
        {new Date(mesVisao + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
      </div>
      <button onClick={() => navegarMes(1)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>▶</button>
      <button onClick={() => { setMesVisao(new Date().toISOString().slice(0, 7)); }} style={{ padding: '4px 8px', borderRadius: 6, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, cursor: 'pointer' }}>Hoje</button>
    </div>

    {/* KPIs */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
      <div className="summary-card" style={{ flex: 1, minWidth: '30%' }}><div className="summary-sub">A Pagar no Mês</div><div className="summary-value vermelho">{fmtCurrency(resumo?.total_mes)}</div><div className="summary-sub">{resumo?.pendentes || 0} pendentes</div></div>
      <div className="summary-card" style={{ flex: 1, minWidth: '30%' }}><div className="summary-sub">Vencidas</div><div className="summary-value vermelho">{fmtCurrency(resumo?.total_vencidas)}</div><div className="summary-sub">{resumo?.vencidas || 0} contas</div></div>
      <div className="summary-card" style={{ flex: 1, minWidth: '30%' }}><div className="summary-sub">Pago no Mês</div><div className="summary-value verde">{fmtCurrency(resumo?.total_pago)}</div><div className="summary-sub">{resumo?.pagas || 0} pagas</div></div>
      <div className="summary-card" style={{ flex: 1, minWidth: '30%' }}><div className="summary-sub">Próx. 7 dias</div><div className="summary-value">{fmtCurrency(resumo?.total_proximos_7d)}</div><div className="summary-sub">{resumo?.proximos_7d || 0} contas</div></div>
    </div>

    {/* Calendário */}
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8, fontWeight: 600 }}>📅 CALENDÁRIO DE VENCIMENTOS</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>{d}</div>)}
        {(() => {
          const [ano, mes] = mesVisao.split('-').map(Number)
          const primeiroDia = new Date(ano, mes - 1, 1).getDay()
          const cells: (React.ReactNode)[] = []
          for (let i = 0; i < primeiroDia; i++) cells.push(<div key={'e' + i} />)
          for (const d of diasDoMes) {
            const tem = d.contas.length > 0
            const vencida = tem && d.dia < parseInt(hojeBR().slice(8, 10)) && mesVisao === hojeBR().slice(0, 7)
            cells.push(
              <div key={d.dia} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 11,
                background: vencida ? 'oklch(60% 0.2 20 / 0.25)' : tem ? 'oklch(60% 0.15 55 / 0.25)' : 'transparent',
                color: tem ? 'var(--fg)' : 'var(--muted)', fontWeight: tem ? 700 : 400, cursor: tem ? 'pointer' : 'default',
              }}>
                {d.dia}
              </div>
            )
          }
          return cells
        })()}
      </div>
    </div>

    {/* Filtros + busca */}
    <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
      <input className="form-input" placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: 1, minWidth: 120 }} />
      <select className="form-select" value={filtroFornecedor} onChange={e => setFiltroFornecedor(e.target.value)} style={{ flex: 1, minWidth: 100 }}>
        <option value="">Todos fornecedores</option>
        {fornecedores.map(f => <option key={f} value={f}>{f}</option>)}
      </select>
      <select className="form-select" value={filtroTipoDoc} onChange={e => setFiltroTipoDoc(e.target.value)} style={{ flex: 1, minWidth: 90 }}>
        <option value="">Todos docs</option>
        {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>

    {/* Abas */}
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {(['pendentes', 'pagas'] as const).map(t => (
        <button key={t} onClick={() => setAba(t)}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: aba === t ? 'var(--accent)' : 'var(--surface)', color: aba === t ? 'var(--bg)' : 'var(--muted)' }}>
          {t === 'pendentes' ? `🔴 Pendentes (${contas.length})` : `✅ Pagas (${pagas.length})`}
        </button>
      ))}
    </div>

    {/* Agrupamento por fornecedor */}
    {aba === 'pendentes' && Object.keys(contasPorFornecedor).length > 0 && (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6, fontWeight: 600 }}>🏢 POR FORNECEDOR</div>
        {Object.entries(contasPorFornecedor).map(([f, lista]) => (
          <div key={f} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
              <span>{f}</span>
              <span style={{ color: 'var(--vermelho)' }}>{fmtCurrency(lista.reduce((s, c) => s + parseFloat(String(c.valor) || '0'), 0))}</span>
            </div>
            {lista.map(c => renderConta(c, false))}
          </div>
        ))}
      </div>
    )}

    {aba === 'pendentes' && contas.length === 0 && <EmptyState msg="Nenhuma conta pendente neste mês" cta="Adicionar" />}

    {aba === 'pagas' && pagas.length === 0 && <EmptyState msg="Nenhuma conta paga" />}
    {aba === 'pagas' && pagas.length > 0 && <>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Total pago: <strong style={{ color: 'var(--verde)' }}>{fmtCurrency(pagas.reduce((s, c) => s + parseFloat(String(c.valor_pago ?? c.valor) || '0'), 0))}</strong></div>
      {pagas.map(c => renderConta(c, false))}
    </>}

    {/* Modal nova conta */}
    {showModal && <Modal titulo="➕ Nova Conta a Pagar" onClose={() => setShowModal(false)} fullHeight>
        <input className="form-input" placeholder="Descrição (ex: Nota de frango)" value={novaDesc} onChange={e => setNovaDesc(e.target.value)} autoFocus />
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <input className="form-input" type="number" step="0.01" placeholder="Valor (R$)" value={novaValor} onChange={e => setNovaValor(e.target.value)} style={{ flex: 1 }} />
          <input className="form-input" type="date" value={novaData} onChange={e => setNovaData(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ position: 'relative', marginTop: 8 }}>
          <input className="form-input" placeholder="🏢 Fornecedor (ex: Açougue Central)" value={novaFornecedor} onChange={e => { setNovaFornecedor(e.target.value); setShowFornecedores(true) }} onFocus={() => setShowFornecedores(true)} ref={fornecedorRef} />
          {showFornecedores && novaFornecedor !== '' && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
              {fornecedoresFiltrados.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--muted)' }}>Nenhum fornecedor salvo</div>}
              {fornecedoresFiltrados.map(f => (
                <button key={f} onClick={() => { setNovaFornecedor(f); setShowFornecedores(false) }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg)' }}>{f}</button>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          <select className="form-select" value={novaTipoDoc} onChange={e => setNovaTipoDoc(e.target.value)} style={{ flex: 1 }}>
            {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className="form-select" value={novaCategoria} onChange={e => setNovaCategoria(e.target.value)} style={{ flex: 1 }}>
            <option value="">Categoria</option>
            {categorias.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <textarea className="form-input" placeholder="Observações (opcional)" value={novaObs} onChange={e => setNovaObs(e.target.value)} rows={2} style={{ marginTop: 8 }} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={novaRecorrente} onChange={e => setNovaRecorrente(e.target.checked)} />
          🔁 Recorrente (botão para gerar próximo mês)
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginTop: 6, cursor: 'pointer' }}>
          <input type="checkbox" checked={novaJaLancada} onChange={e => setNovaJaLancada(e.target.checked)} />
          🧾 Custo já lançado na compra do dia (não gerar despesa ao pagar)
        </label>
        <button onClick={() => criarConta()} disabled={salvando} className="btn btn-primary" style={{ width: '100%', marginTop: 12, height: 42 }}>
          {salvando ? '⏳ Salvando...' : '✅ Criar Conta'}
        </button>
    </Modal>}

    {/* Modal pagamento com método */}
    {pagandoConta && <Modal titulo={`💳 Pagar: ${pagandoConta.descricao}`} onClose={() => setPagandoConta(null)}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Valor: <strong style={{ color: 'var(--vermelho)' }}>{fmtCurrency(parseFloat(String(pagandoConta.valor)) || 0)}</strong>
          {diasAtraso(pagandoConta) > 0 && <> · <span style={{ color: 'var(--vermelho)' }}>{diasAtraso(pagandoConta)}d em atraso</span></>}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>Método de pagamento</div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {METODOS.map(m => (
            <button key={m.key} onClick={() => setPgMetodo(m.key)}
              style={{ padding: '8px 12px', borderRadius: 8, border: pgMetodo === m.key ? '1px solid var(--accent)' : '1px solid var(--border)', background: pgMetodo === m.key ? 'var(--accent)' : 'var(--surface)', color: pgMetodo === m.key ? 'var(--bg)' : 'var(--fg)', fontSize: 12, cursor: 'pointer' }}>
              {m.icon} {m.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input className="form-input" type="date" value={pgData} onChange={e => setPgData(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input className="form-input" type="number" step="0.01" placeholder="Multa (R$)" value={pgMulta} onChange={e => setPgMulta(e.target.value)} style={{ flex: 1 }} />
          <input className="form-input" type="number" step="0.01" placeholder="Juros (R$)" value={pgJuros} onChange={e => setPgJuros(e.target.value)} style={{ flex: 1 }} />
        </div>
        <div style={{ fontSize: 13, marginBottom: 10 }}>
          Total a pagar: <strong style={{ color: 'var(--vermelho)' }}>{fmtCurrency((parseFloat(String(pagandoConta.valor)) || 0) + (parseFloat(pgMulta) || 0) + (parseFloat(pgJuros) || 0))}</strong>
        </div>
        <button onClick={() => pagarConta(pagandoConta)} disabled={pagarId === pagandoConta.id} className="btn btn-primary" style={{ width: '100%', height: 42 }}>
          {pagarId === pagandoConta.id ? '⏳ Pagando...' : `✅ Confirmar Pagamento`}
        </button>
    </Modal>}
  </>
}
