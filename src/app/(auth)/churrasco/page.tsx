'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Loading, EmptyState, Modal } from '@/app/components/Shared'
import toast from 'react-hot-toast'

type Carne = {
  id: string
  nome: string
  tipo_corte: string
  quantidade_kg: number
  estoque_minimo_kg: number
  preco_kg_compra: number
  preco_kg_venda: number
  fornecedor?: string
  ativo?: boolean
}

type Consumo = {
  id: string
  data: string
  corte_id?: string
  quantidade_kg: number
  valor_total: number
  observacao?: string
  corte_nome?: string
}

type Alertas = {
  hoje: string
  estoque_baixo: { id: string; nome: string; quantidade_kg: number; estoque_minimo_kg: number }[]
  carne_parada: { id: string; nome: string; ultimo_uso: string | null }[]
  maior_consumo: { id: string; nome: string; kg: number } | null
  sugestao_compra: { id: string; nome: string; quantidade_kg: number; estoque_minimo_kg: number; consumo_semana: number; comprar: number; custo: number }[]
  total_sugestao: number
}

const inputStyle = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' as const, marginBottom: 8 } as const
const labelStyle = { fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 } as const

export default function ChurrascoPage() {
  const { loading: authLoading, apiGet, apiPut, apiPost, apiDelete } = useAuth()
  const [loading, setLoading] = useState(true)
  const [carnes, setCarnes] = useState<Carne[]>([])
  const [consumos, setConsumos] = useState<Consumo[]>([])
  const [alertas, setAlertas] = useState<Alertas | null>(null)
  const [aba, setAba] = useState<'baixa' | 'estoque' | 'historico'>('baixa')
  const [forceUpdate, setForceUpdate] = useState(0)

  const [baixas, setBaixas] = useState<Record<string, string>>({})
  const [obsBaixa, setObsBaixa] = useState('')
  const [salvandoBaixa, setSalvandoBaixa] = useState(false)

  const [modalCarne, setModalCarne] = useState<Carne | 'nova' | null>(null)
  const [carneForm, setCarneForm] = useState<Record<string, string>>({})
  const [salvandoCarne, setSalvandoCarne] = useState(false)

  const [histDias, setHistDias] = useState(7)
  const [histCarne, setHistCarne] = useState('')
  const [histResumo, setHistResumo] = useState<any>(null)

  const [modalEdicao, setModalEdicao] = useState<Consumo | null>(null)
  const [editKg, setEditKg] = useState('')
  const [editObs, setEditObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [carnesRes, alertasRes] = await Promise.all([
        apiGet('/api/churrasco/carnes'),
        apiGet('/api/churrasco/alertas'),
      ])
      if (Array.isArray(carnesRes)) setCarnes(carnesRes)
      if (alertasRes && !alertasRes.error) setAlertas(alertasRes)
    } catch (err) { console.error(err) }
    setLoading(false)
  }, [apiGet])

  useEffect(() => {
    if (authLoading) return
    carregar()
  }, [authLoading, forceUpdate, carregar])

  useEffect(() => {
    if (authLoading) return
    const params = new URLSearchParams({ dias: String(histDias) })
    if (histCarne) params.set('corte_id', histCarne)
    apiGet(`/api/churrasco/consumo?${params.toString()}`).then(l => { if (Array.isArray(l)) setConsumos(l) })
    apiGet(`/api/churrasco/resumo?${params.toString()}`).then(r => { if (r && !r.error) setHistResumo(r) })
  }, [authLoading, histDias, histCarne, forceUpdate, apiGet])

  const carnesAtivas = carnes.filter(c => c.ativo !== false)
  const totalKgEstoque = carnesAtivas.reduce((s, c) => s + (parseFloat(String(c.quantidade_kg)) || 0), 0)
  const totalValorEstoque = carnesAtivas.reduce((s, c) => s + (parseFloat(String(c.quantidade_kg)) || 0) * (parseFloat(String(c.preco_kg_compra)) || 0), 0)
  const totalBaixas = Object.values(baixas).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const custoEstimadoBaixa = carnesAtivas.reduce((s, c) => s + (parseFloat(baixas[c.id] || '') || 0) * (parseFloat(String(c.preco_kg_compra)) || 0), 0)

  async function salvarBaixa() {
    const itens = carnesAtivas
      .map(c => ({ carne: c, kg: parseFloat(baixas[c.id] || '') }))
      .filter(i => i.kg > 0)
    if (itens.length === 0) { toast.error('Digite a quantidade de pelo menos uma carne'); return }
    for (const it of itens) {
      if (it.kg > (parseFloat(String(it.carne.quantidade_kg)) || 0)) {
        toast.error(`${it.carne.nome}: baixa maior que o estoque (${it.carne.quantidade_kg}kg)`)
        return
      }
    }
    setSalvandoBaixa(true)
    const data = new Date().toISOString().slice(0, 10)
    let ok = 0, falha = 0
    for (const it of itens) {
      try {
        const cons = await apiPost('/api/churrasco/consumo', {
          data, corte_id: it.carne.id, quantidade_kg: it.kg, observacao: obsBaixa || null,
        })
        if (cons?.error) throw new Error(cons.error)
        ok++
      } catch (e: any) { falha++; toast.error(`${it.carne.nome}: ${e?.message || 'erro'}`) }
    }
    toast.success(`${ok} baixa(s) salva(s)${falha > 0 ? `, ${falha} falha(s)` : ''}!`)
    setBaixas({}); setObsBaixa('')
    setForceUpdate(v => v + 1)
    setSalvandoBaixa(false)
  }

  async function abrirCarne(c?: Carne) {
    setModalCarne(c || 'nova')
    setCarneForm(c ? {
      nome: c.nome, tipo_corte: c.tipo_corte || '', estoque_minimo_kg: String(c.estoque_minimo_kg || 5),
      preco_kg_compra: String(c.preco_kg_compra || ''), preco_kg_venda: String(c.preco_kg_venda || ''), fornecedor: c.fornecedor || '',
    } : {})
  }

  async function salvarCarne() {
    if (!modalCarne) return
    if (!carneForm.nome?.trim()) { toast.error('Informe o nome da carne'); return }
    setSalvandoCarne(true)
    try {
      if (modalCarne === 'nova') {
        const res = await apiPost('/api/churrasco/carnes', {
          nome: carneForm.nome, tipo_corte: carneForm.tipo_corte,
          quantidade_kg: parseFloat(carneForm.estoque_inicial) || 0,
          estoque_minimo_kg: parseFloat(carneForm.estoque_minimo_kg) || 5,
          preco_kg_compra: parseFloat(carneForm.preco_kg_compra) || 0,
          preco_kg_venda: parseFloat(carneForm.preco_kg_venda) || 0,
          fornecedor: carneForm.fornecedor || null,
        })
        if (res?.error) throw new Error(res.error)
        toast.success('Carne cadastrada!')
      } else {
        const res = await apiPut(`/api/churrasco/carnes/${modalCarne.id}`, {
          nome: carneForm.nome, tipo_corte: carneForm.tipo_corte,
          estoque_minimo_kg: parseFloat(carneForm.estoque_minimo_kg) || 5,
          preco_kg_compra: parseFloat(carneForm.preco_kg_compra) || 0,
          preco_kg_venda: parseFloat(carneForm.preco_kg_venda) || 0,
          fornecedor: carneForm.fornecedor || null,
        })
        if (res?.error) throw new Error(res.error)
        toast.success('Carne atualizada!')
      }
      setModalCarne(null)
      setForceUpdate(v => v + 1)
    } catch (e: any) { toast.error(e?.message || 'Erro ao salvar carne') }
    setSalvandoCarne(false)
  }

  function toggleAtivo(c: Carne) {
    apiPut(`/api/churrasco/carnes/${c.id}`, { ativo: c.ativo === false }).then(() => {
      toast.success(c.ativo === false ? 'Carne ativada!' : 'Carne desativada')
      setForceUpdate(v => v + 1)
    })
  }

  async function salvarEdicao() {
    if (!modalEdicao) return
    const kg = parseFloat(editKg)
    if (isNaN(kg) || kg <= 0) { toast.error('Informe kg válido'); return }
    const carne = carnes.find(c => c.id === modalEdicao.corte_id)
    const valor_total = Math.round(kg * (parseFloat(String(carne?.preco_kg_compra)) || 0) * 100) / 100
    setSalvandoBaixa(true)
    try {
      const res = await apiPut(`/api/churrasco/consumo/${modalEdicao.id}`, { quantidade_kg: kg, valor_total, observacao: editObs })
      if (res?.error) throw new Error(res.error)
      toast.success('Baixa atualizada!')
      setModalEdicao(null)
      setForceUpdate(v => v + 1)
    } catch (e: any) { toast.error(e?.message || 'Erro ao editar') }
    setSalvandoBaixa(false)
  }

  async function excluirConsumo(c: Consumo) {
    if (!confirm(`Excluir a baixa de ${c.corte_nome} (${c.quantidade_kg}kg)?`)) return
    try {
      const res = await apiDelete(`/api/churrasco/consumo/${c.id}`)
      if (res?.error) throw new Error(res.error)
      toast.success('Baixa excluída')
      setForceUpdate(v => v + 1)
    } catch (e: any) { toast.error(e?.message || 'Erro ao excluir') }
  }

  if (authLoading || loading) return <Loading />

  const precisaComprar = (alertas?.sugestao_compra || []).filter(s => s.comprar > 0)

  const abas = [
    { key: 'baixa', label: '📉 Baixa do Dia' },
    { key: 'estoque', label: '🥩 Estoque' },
    { key: 'historico', label: '🗂️ Histórico' },
  ] as const

  return <>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, color: 'var(--accent)' }}>🥩 Churrasco</span>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
      <div className="summary-card" style={{ flex: 1 }}><div className="summary-sub">Estoque Total</div><div className="summary-value">{totalKgEstoque.toFixed(1)} kg</div></div>
      <div className="summary-card" style={{ flex: 1 }}><div className="summary-sub">Valor em Estoque</div><div className="summary-value accent">{fmtCurrency(totalValorEstoque)}</div></div>
      <div className="summary-card" style={{ flex: 1 }}><div className="summary-sub">Baixas</div><div className={`summary-value ${(alertas?.estoque_baixo?.length || 0) > 0 ? 'vermelho' : 'verde'}`}>{alertas?.estoque_baixo?.length || 0}</div></div>
    </div>

    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {abas.map(t => (
        <button key={t.key} onClick={() => setAba(t.key)}
          style={{ flex: 1, padding: '9px 6px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: aba === t.key ? 'var(--accent)' : 'var(--surface)', color: aba === t.key ? 'var(--bg)' : 'var(--muted)' }}>
          {t.label}
        </button>
      ))}
    </div>

    {aba === 'baixa' && <>
      <button onClick={() => setAba('baixa')} className="btn btn-primary" style={{ width: '100%', height: 48, fontSize: 15, marginBottom: 4 }}>
        📉 Registrar Baixa do Dia
      </button>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>Informe quanto de cada carne será consumido/baixado hoje.</div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', marginBottom: 10 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>Total kg</div><div style={{ fontSize: 18, fontWeight: 700 }}>{totalBaixas.toFixed(1)} kg</div></div>
          <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: 'var(--muted)' }}>Custo estimado</div><div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{fmtCurrency(custoEstimadoBaixa)}</div></div>
        </div>
      </div>

      {carnesAtivas.length === 0
        ? <EmptyState msg="Nenhuma carne cadastrada" cta={`<button class="btn btn-primary" onclick="setAba('estoque')">📦 Cadastrar</button>`} />
        : carnesAtivas.map(c => {
          const kg = parseFloat(baixas[c.id] || '') || 0
          const max = parseFloat(String(c.quantidade_kg)) || 0
          const invalido = kg > max
          const baixo = max < (parseFloat(String(c.estoque_minimo_kg)) || 5)
          return <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: 'var(--surface)', borderRadius: 8, border: `1px solid ${invalido ? 'var(--vermelho)' : 'var(--border)'}`, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{c.nome} {baixo && <span style={{ color: 'var(--vermelho)', fontSize: 11 }}>⚠️</span>}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{max.toFixed(1)}kg</span>
            <input type="number" min="0" step="0.1" placeholder="kg" value={baixas[c.id] || ''}
              onChange={e => setBaixas(p => ({ ...p, [c.id]: e.target.value }))}
              style={{ width: 74, padding: '8px 8px', borderRadius: 8, border: `1px solid ${invalido ? 'var(--vermelho)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', fontSize: 14, textAlign: 'center' }} />
          </div>
        })}

      <input className="form-input" placeholder="Observação (opcional)" value={obsBaixa} onChange={e => setObsBaixa(e.target.value)} style={{ marginTop: 8 }} />
      <button onClick={salvarBaixa} disabled={salvandoBaixa || totalBaixas <= 0} className="btn btn-primary"
        style={{ width: '100%', height: 48, fontSize: 15, marginTop: 8, opacity: (salvandoBaixa || totalBaixas <= 0) ? 0.5 : 1 }}>
        {salvandoBaixa ? '⏳ Salvando...' : `✅ Salvar Baixa (${totalBaixas.toFixed(1)} kg)`}
      </button>
    </>}

    {aba === 'estoque' && <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={() => abrirCarne()} className="btn btn-primary" style={{ flex: 1, height: 44 }}>
          ➕ Nova Carne
        </button>
      </div>

      {precisaComprar.length > 0 && <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 12, border: '1px solid var(--accent)', marginBottom: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>🛒 Sugestão de Compra <span style={{ color: 'var(--accent)', fontWeight: 700 }}>({fmtCurrency(alertas!.total_sugestao)})</span></div>
        {precisaComprar.map(s => (
          <div key={s.id} style={{ fontSize: 12, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
            {s.nome}: <strong>comprar {s.comprar}kg</strong> <span style={{ color: 'var(--muted)' }}>({fmtCurrency(s.custo)} · consumo {s.consumo_semana}kg/semana)</span>
          </div>
        ))}
      </div>}

      {carnesAtivas.length === 0 ? <EmptyState msg="Nenhuma carne cadastrada" /> : carnesAtivas.map(c => {
        const baixo = (parseFloat(String(c.quantidade_kg)) || 0) < (parseFloat(String(c.estoque_minimo_kg)) || 5)
        return <div key={c.id} style={{ background: 'var(--surface)', borderRadius: 10, border: `1px solid ${baixo ? 'var(--vermelho)' : 'var(--border)'}`, padding: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.nome}</span>
              {baixo && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--vermelho)', fontWeight: 700 }}>⚠️ BAIXO</span>}
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: baixo ? 'var(--vermelho)' : 'var(--fg)' }}>
              {parseFloat(String(c.quantidade_kg)).toFixed(1)} <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 400 }}>kg</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginTop: 4, alignItems: 'center' }}>
            <span>Mín: {c.estoque_minimo_kg} kg · {fmtCurrency(c.preco_kg_compra)}/kg</span>
            {c.fornecedor && <span>🏢 {c.fornecedor}</span>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => abrirCarne(c)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15 }}>✏️</button>
              <button onClick={() => toggleAtivo(c)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--muted)' }}>{c.ativo === false ? '✅' : '⏸️'}</button>
            </div>
          </div>
        </div>
      })}

      {(alertas?.estoque_baixo?.length || 0) > 0 && <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--vermelho)', marginBottom: 6 }}>⚠️ Estoque baixo</div>
        {alertas!.estoque_baixo.map(e => <div key={e.id} style={{ fontSize: 12, padding: '4px 0' }}>{e.nome}: {e.quantidade_kg}kg (mín {e.estoque_minimo_kg}kg)</div>)}
      </div>}
    </>}

    {aba === 'historico' && <>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {[7, 15, 30].map(d => (
          <button key={d} onClick={() => setHistDias(d)}
            style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: histDias === d ? 'var(--accent)' : 'var(--surface)', color: histDias === d ? 'var(--bg)' : 'var(--muted)' }}>
            {d} dias
          </button>
        ))}
      </div>
      <select className="form-select" value={histCarne} onChange={e => setHistCarne(e.target.value)} style={{ marginBottom: 8, width: '100%' }}>
        <option value="">Todas as carnes</option>
        {carnesAtivas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
      </select>

      {histResumo && <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div className="summary-card" style={{ flex: 1 }}><div className="summary-sub">Total kg</div><div className="summary-value">{histResumo.total_kg} kg</div></div>
        <div className="summary-card" style={{ flex: 1 }}><div className="summary-sub">Custo</div><div className="summary-value vermelho">{fmtCurrency(histResumo.total_custo)}</div></div>
      </div>}

      {consumos.length === 0 ? <EmptyState msg="Nenhum consumo no período" /> : consumos.map(c => (
        <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px', background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{c.corte_nome}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>{new Date(c.data + 'T00:00:00').toLocaleDateString('pt-BR')}{c.observacao ? ' · ' + c.observacao : ''}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{parseFloat(String(c.quantidade_kg)).toFixed(1)} kg</div>
              <div style={{ fontSize: 11, color: 'var(--vermelho)' }}>-{fmtCurrency(c.valor_total)}</div>
            </div>
            <button onClick={() => { setModalEdicao(c); setEditKg(String(c.quantidade_kg)); setEditObs(c.observacao || '') }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15 }}>✏️</button>
            <button onClick={() => excluirConsumo(c)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15 }}>🗑️</button>
          </div>
        </div>
      ))}
    </>}

    {modalCarne && <Modal titulo={modalCarne === 'nova' ? '➕ Nova Carne' : `✏️ Editar ${modalCarne.nome}`} onClose={() => setModalCarne(null)}>
      <label style={labelStyle}>🥩 Nome</label>
      <input style={inputStyle} value={carneForm.nome || ''} onChange={e => setCarneForm({ ...carneForm, nome: e.target.value })} placeholder="Ex: Picanha" />
      <label style={labelStyle}>Corte / tipo</label>
      <input style={inputStyle} value={carneForm.tipo_corte || ''} onChange={e => setCarneForm({ ...carneForm, tipo_corte: e.target.value })} placeholder="Ex.: Alcatra" />
      {modalCarne === 'nova' && <>
        <label style={labelStyle}>Estoque inicial (kg)</label>
        <input style={inputStyle} type="number" step="0.1" min="0" value={carneForm.estoque_inicial || ''} onChange={e => setCarneForm({ ...carneForm, estoque_inicial: e.target.value })} placeholder="0" />
      </>}
      <label style={labelStyle}>Estoque mínimo (kg)</label>
      <input style={inputStyle} type="number" step="0.1" min="0" value={carneForm.estoque_minimo_kg || ''} onChange={e => setCarneForm({ ...carneForm, estoque_minimo_kg: e.target.value })} placeholder="5" />
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, marginBottom: 2 }}>Preço compra (R$/kg)</label>
          <input style={inputStyle} type="number" step="0.01" min="0" value={carneForm.preco_kg_compra || ''} onChange={e => setCarneForm({ ...carneForm, preco_kg_compra: e.target.value })} placeholder="0" />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ ...labelStyle, marginBottom: 2 }}>Preço venda (R$/kg)</label>
          <input style={inputStyle} type="number" step="0.01" min="0" value={carneForm.preco_kg_venda || ''} onChange={e => setCarneForm({ ...carneForm, preco_kg_venda: e.target.value })} placeholder="0" />
        </div>
      </div>
      <label style={labelStyle}>Fornecedor</label>
      <input style={inputStyle} value={carneForm.fornecedor || ''} onChange={e => setCarneForm({ ...carneForm, fornecedor: e.target.value })} placeholder="Opcional" />
      <button onClick={salvarCarne} disabled={salvandoCarne} className="btn btn-primary" style={{ width: '100%', height: 46, marginTop: 4 }}>
        {salvandoCarne ? '⏳ Salvando...' : modalCarne === 'nova' ? '✅ Cadastrar' : '✅ Salvar'}
      </button>
    </Modal>}

    {modalEdicao && <Modal titulo={`✏️ Editar Baixa — ${modalEdicao.corte_nome}`} onClose={() => setModalEdicao(null)}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>Data: {new Date(modalEdicao.data + 'T00:00:00').toLocaleDateString('pt-BR')}</div>
      <input className="form-input" type="number" step="0.1" min="0" placeholder="Quantidade (kg)" value={editKg} onChange={e => setEditKg(e.target.value)} />
      <input className="form-input" placeholder="Observação" value={editObs} onChange={e => setEditObs(e.target.value)} style={{ marginTop: 8 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={() => setModalEdicao(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
        <button onClick={salvarEdicao} disabled={salvandoBaixa} className="btn btn-primary" style={{ flex: 2 }}>
          {salvandoBaixa ? '⏳' : 'Salvar'}
        </button>
      </div>
    </Modal>}
  </>
}

