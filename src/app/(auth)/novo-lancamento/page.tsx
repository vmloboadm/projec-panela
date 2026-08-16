'use client'

import { useState, useEffect } from 'react'
import { useAuth, resolveCategoriaId } from '@/app/components/useAuth'
import { Loading, CategoryPicker } from '@/app/components/Shared'
import { itemSchema } from '@/lib/schemas'
import toast from 'react-hot-toast'
import { useQueryClient } from '@tanstack/react-query'

type Item = {
  id: string
  tipo_registro: 'lancamento' | 'conta_a_pagar' | 'insumo_churrasco'
  tipo: 'receita' | 'despesa'
  valor: number
  descricao: string
  categoria: string
  data: string
  data_vencimento?: string
  corte_id?: string
  quantidade_kg?: number
  preco_kg?: number
  fornecedor?: string
}

const RASCUNHO_KEY = 'panela_rascunho_itens'
const RASCUNHO_TEXTO_KEY = 'panela_rascunho_texto_ia'

function hojeBR() { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().slice(0, 10) }

function restaurarRascunho(): Item[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RASCUNHO_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}

export default function NovoPage() {
  const qc = useQueryClient()
  const { loading: authLoading, apiGet, apiPost, apiPut } = useAuth()
  const [aba, setAba] = useState<'manual' | 'ia' | 'foto'>('manual')
  const [textoIA, setTextoIA] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return localStorage.getItem(RASCUNHO_TEXTO_KEY) || '' } catch { return '' }
  })
  const [processando, setProcessando] = useState(false)
  const [itens, setItens] = useState<Item[]>(() => restaurarRascunho())
  const [categorias, setCategorias] = useState<any[]>([])
  const [cortes, setCortes] = useState<any[]>([])
  const [salvando, setSalvando] = useState(false)
  const [tempoIA, setTempoIA] = useState(0)

  const [manualTipo, setManualTipo] = useState<'receita'|'despesa'>('despesa')
  const [manualDesc, setManualDesc] = useState('')
  const [manualValor, setManualValor] = useState('')
  const [manualCategoria, setManualCategoria] = useState('')
  const [manualData, setManualData] = useState(new Date().toISOString().slice(0,10))
  const [manualRegistro, setManualRegistro] = useState<'lancamento'|'conta_a_pagar'|'insumo_churrasco'>('lancamento')
  const [manualTipoReg, setManualTipoReg] = useState<'receita'|'despesa'>('despesa')
  const [manualVencimento, setManualVencimento] = useState('')
  const [manualCorte, setManualCorte] = useState('')
  const [manualKg, setManualKg] = useState('')
  const [manualPrecoKg, setManualPrecoKg] = useState('')
  const [manualFornecedor, setManualFornecedor] = useState('')

  useEffect(() => {
    if (authLoading) return
    Promise.all([apiGet('/api/categorias'), apiGet('/api/churrasco/carnes')]).then(([cats, cs]) => {
      if (cats) setCategorias(cats)
      if (cs) setCortes(cs)
    })
  }, [authLoading])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (itens.length > 0) localStorage.setItem(RASCUNHO_KEY, JSON.stringify(itens))
      else localStorage.removeItem(RASCUNHO_KEY)
    } catch {}
  }, [itens])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (textoIA.trim()) localStorage.setItem(RASCUNHO_TEXTO_KEY, textoIA)
      else localStorage.removeItem(RASCUNHO_TEXTO_KEY)
    } catch {}
  }, [textoIA])

  function adicionarManual() {
    const item: Item = {
      id: Math.random().toString(36).slice(2, 10),
      tipo_registro: manualRegistro,
      tipo: manualTipoReg,
      valor: parseFloat(manualValor) || 0,
      descricao: manualDesc,
      categoria: manualCategoria,
      data: manualData,
      data_vencimento: manualVencimento || undefined,
      corte_id: manualCorte || undefined,
      quantidade_kg: manualKg ? parseFloat(manualKg) : undefined,
      preco_kg: manualPrecoKg ? parseFloat(manualPrecoKg) : undefined,
      fornecedor: manualFornecedor || undefined,
    }

    const parsed = itemSchema.safeParse(item)
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Erro de validação')
      return
    }

    setItens(prev => [...prev, item])
    setManualDesc(''); setManualValor(''); setManualCategoria('')
    setManualKg(''); setManualPrecoKg(''); setManualCorte(''); setManualFornecedor('')
    toast.success('Item adicionado!')
  }

  function removerItem(id: string) { setItens(prev => prev.filter(i => i.id !== id)) }

  function atualizarItem(id: string, campo: string, valor: any) {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [campo]: valor } : i))
  }

  async function processarIA() {
    setProcessando(true)
    setTempoIA(0)
    const inicio = Date.now()
    const timer = setInterval(() => setTempoIA(Math.round((Date.now() - inicio) / 1000)), 1000)
    try {
      const res = await apiPost('/api/ia/texto', { texto: textoIA })
      const catIdPorNome: Record<string, string> = {}
      for (const c of categorias) catIdPorNome[(c.nome || '').toLowerCase()] = c.id
      const itensNovos: Item[] = (res?.itens || []).map((r: any) => {
        const nomeCat = (r.categoria || '').toLowerCase()
        const categoria = (r.categoria_id || catIdPorNome[nomeCat] || '')
        return {
          id: Math.random().toString(36).slice(2, 10),
          tipo_registro: r.tipo_registro || 'lancamento',
          tipo: r.tipo || 'despesa',
          valor: parseFloat(r.valor) || 0,
          descricao: r.descricao || textoIA.slice(0, 60),
          categoria,
          data: r.data || new Date().toISOString().slice(0, 10),
          data_vencimento: r.data_vencimento || undefined,
          corte_id: r.corte_id || undefined,
          quantidade_kg: parseFloat(r.quantidade_kg) || undefined,
          preco_kg: parseFloat(r.preco_kg) || undefined,
          fornecedor: r.fornecedor || undefined,
        }
      })
      setItens(prev => [...prev, ...itensNovos])
      if (itensNovos.length === 0) toast.error('IA não conseguiu interpretar')
      else toast.success(`${itensNovos.length} item(ns) adicionados via IA`)
    } catch { toast.error('Erro ao processar com IA') }
    clearInterval(timer)
    setProcessando(false)
  }

  async function salvarTodos() {
    if (itens.length === 0) return
    setSalvando(true)
    let ok = 0, falha = 0
    for (const item of itens) {
      try {
        if (item.tipo_registro === 'conta_a_pagar') {
          await apiPost('/api/contas-a-pagar', {
            descricao: item.descricao, valor: item.valor, dia_vencimento: parseInt(item.data_vencimento?.slice(-2) || '10'),
            categoria_id: item.categoria || undefined, data_vencimento: item.data_vencimento, recorrente: false,
          })
        } else if (item.tipo_registro === 'insumo_churrasco') {
          const corte = cortes.find((c: any) => c.id === item.corte_id)
          if (!corte) throw new Error('Corte não encontrado')
          const novoEstoque = (corte.quantidade_kg || 0) + (item.quantidade_kg || 0)
          const valorCompra = item.valor > 0 ? item.valor : (item.quantidade_kg || 0) * (item.preco_kg || 0)
          const up = await apiPut(`/api/churrasco/carnes/${item.corte_id}`, { quantidade_kg: novoEstoque, preco_kg_compra: item.preco_kg, fornecedor: item.fornecedor })
          if (up?.error) throw new Error(up.error)
          const catId = await resolveCategoriaId(apiGet, apiPost, 'Carnes')
          const lanc = await apiPost('/api/lancamentos', {
            tipo: 'despesa', valor: valorCompra, descricao: `COMPRA: ${corte.nome} ${item.quantidade_kg}kg`,
            data: item.data, categoria_id: catId, afeta_caixa: true, afeta_resultado: false,
          })
          if (lanc?.error) throw new Error(lanc.error)
        } else {
          await apiPost('/api/lancamentos', { tipo: item.tipo, valor: item.valor, descricao: item.descricao, data: item.data, categoria_id: item.categoria || undefined })
        }
        ok++
      } catch { falha++ }
    }
    toast.success(`${ok} salvos${falha > 0 ? `, ${falha} falharam` : ''}`)
    if (falha === 0) {
      setItens([])
      try { localStorage.removeItem(RASCUNHO_KEY) } catch {}
    }
    setSalvando(false)
    if (ok > 0) {
      qc.invalidateQueries({ queryKey: ['gestao'] })
      qc.invalidateQueries({ queryKey: ['evolucao'] })
      qc.invalidateQueries({ queryKey: ['lancamentos'] })
      qc.invalidateQueries({ queryKey: ['contas-pagar'] })
      qc.invalidateQueries({ queryKey: ['carnes'] })
      qc.invalidateQueries({ queryKey: ['fechamento'] })
      qc.invalidateQueries({ queryKey: ['despesas'] })
      qc.invalidateQueries({ queryKey: ['faturamento-30d'] })
    }
  }

  if (authLoading) return <Loading />

  return <>
    <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
      {(['manual', 'ia', 'foto'] as const).map(t => (
        <button key={t} onClick={() => setAba(t)}
          style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            background: aba === t ? 'var(--accent)' : 'var(--surface)', color: aba === t ? 'var(--bg)' : 'var(--muted)', transition: 'all 0.2s' }}>
          {t === 'manual' ? '✏️ Manual' : t === 'ia' ? '🤖 IA' : '📸 Foto'}
        </button>
      ))}
    </div>

    {aba === 'manual' && <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <select className="form-select" value={manualRegistro} onChange={e => setManualRegistro(e.target.value as any)} style={{ flex: 1 }}>
          <option value="lancamento">📊 Lançamento</option>
          <option value="conta_a_pagar">📄 Conta a Pagar</option>
          <option value="insumo_churrasco">🥩 Insumo Churrasco</option>
        </select>
        <select className="form-select" value={manualTipoReg} onChange={e => setManualTipoReg(e.target.value as any)} style={{ flex: 1 }}>
          <option value="despesa">🔥 Despesa</option>
          <option value="receita">💰 Receita</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input className="form-input" type="text" placeholder="Descrição" value={manualDesc} onChange={e => setManualDesc(e.target.value)} style={{ flex: 1 }} />
        <button onClick={adicionarManual} style={{ padding: '10px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>➕</button>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        <input className="form-input" type="number" step="0.01" placeholder="Valor (R$)" value={manualValor} onChange={e => setManualValor(e.target.value)} style={{ flex: 1 }} />
        <input className="form-input" type="date" value={manualData} onChange={e => setManualData(e.target.value)} style={{ flex: 1 }} />
      </div>
      <div style={{ marginTop: 8 }}>
        <CategoryPicker categorias={categorias} value={manualCategoria} onChange={setManualCategoria} filter={(c: any) => ['despesa', 'receita'].includes(c.tipo)} />
      </div>
      {manualRegistro === 'conta_a_pagar' && <input className="form-input" type="date" value={manualVencimento} onChange={e => setManualVencimento(e.target.value)} />}
      {manualRegistro === 'insumo_churrasco' && <>
        <select className="form-select" value={manualCorte} onChange={e => setManualCorte(e.target.value)}>
          <option value="">Selecione o corte</option>
          {cortes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <input className="form-input" placeholder="Quantidade (kg)" value={manualKg} onChange={e => setManualKg(e.target.value)} />
        <input className="form-input" placeholder="Preço por kg (R$)" value={manualPrecoKg} onChange={e => setManualPrecoKg(e.target.value)} />
        <input className="form-input" placeholder="Fornecedor" value={manualFornecedor} onChange={e => setManualFornecedor(e.target.value)} />
      </>}
      <button onClick={adicionarManual} style={{ width: '100%', padding: '10px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>➕ Adicionar Item</button>
    </div>}

    {aba === 'ia' && <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
        Cole aqui a <strong>lista inteira da compra</strong> — a IA separa e categoriza tudo automaticamente:
      </div>
      <textarea className="ia-input" rows={5} value={textoIA} onChange={e => setTextoIA(e.target.value)} placeholder={"Ex: Carne picanha 89,90\nCoca cola 21,00\nAlface e tomate 12,40\nSal e pimenta 9,60\nInseticida Bayer 28,90\nFaca de churrasco 45,00"} />
      <button onClick={processarIA} disabled={processando || !textoIA.trim()} style={{ width: '100%', marginTop: 8, padding: '10px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', opacity: (processando || !textoIA.trim()) ? 0.5 : 1 }}>
        {processando ? `⏳ Separando... ${tempoIA}s` : '🤖 Categorizar com IA'}
      </button>
      {processando && <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 6 }}>Isso pode levar até 30s — pode navegar à vontade, o rascunho fica salvo.</div>}
    </div>}

    {aba === 'foto' && <div style={{ background: 'var(--surface)', borderRadius: 12, padding: 16, border: '1px solid var(--border)', textAlign: 'center' }}>
      <p style={{ color: 'var(--muted)' }}>📸 Em breve: upload de fotos e boletos</p>
    </div>}

    {itens.length > 0 && <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600 }}>📋 {itens.length} item(ns) para confirmar</h3>
        <button onClick={() => { if (confirm('Limpar todos os itens pendentes?')) { setItens([]); try { localStorage.removeItem(RASCUNHO_KEY) } catch {} } }} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--vermelho)', cursor: 'pointer', fontSize: 12 }}>🗑️ Limpar tudo</button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', marginBottom: 8 }}>
        💾 Rascunho salvo automaticamente — você pode sair desta tela e voltar, os itens continuam aqui. Clique em <strong>CONFIRMAR TODOS</strong> para salvar no app.
      </div>
      {itens.map((item, idx) => (
        <div key={item.id} style={{ background: 'var(--surface)', borderRadius: 10, padding: 12, border: '1px solid var(--border)', marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Item {idx+1} de {itens.length}</span>
            <button onClick={() => removerItem(item.id)} style={{ background: 'transparent', border: 'none', color: 'var(--vermelho)', cursor: 'pointer' }}>🗑️ Remover</button>
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <input className="form-input" value={item.descricao} onChange={e => atualizarItem(item.id, 'descricao', e.target.value)} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input className="form-input" type="number" step="0.01" value={item.valor || ''} onChange={e => atualizarItem(item.id, 'valor', parseFloat(e.target.value) || 0)} placeholder="Valor" style={{ flex: 1 }} />
              <CategoryPicker categorias={categorias} value={item.categoria} onChange={(id) => atualizarItem(item.id, 'categoria', id)} />
            </div>
            <select className="form-select" value={item.tipo_registro} onChange={e => atualizarItem(item.id, 'tipo_registro', e.target.value)}>
              <option value="lancamento">📊 Lançamento</option>
              <option value="conta_a_pagar">📄 Conta a Pagar</option>
              <option value="insumo_churrasco">🥩 Insumo Churrasco</option>
            </select>
            {item.tipo_registro === 'conta_a_pagar' && <input className="form-input" type="date" value={item.data_vencimento || ''} onChange={e => atualizarItem(item.id, 'data_vencimento', e.target.value)} />}
            {item.tipo_registro === 'insumo_churrasco' && (
              <>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select className="form-select" value={item.corte_id || ''} onChange={e => atualizarItem(item.id, 'corte_id', e.target.value)} style={{ flex: 1 }}>
                    <option value="">Corte</option>
                    {cortes.map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <input className="form-input" type="number" step="0.1" placeholder="Kg" value={item.quantidade_kg || ''} onChange={e => atualizarItem(item.id, 'quantidade_kg', parseFloat(e.target.value) || 0)} style={{ flex: 0.5 }} />
                </div>
                <input className="form-input" type="number" step="0.01" placeholder="Preço/kg (R$)" value={item.preco_kg || ''} onChange={e => atualizarItem(item.id, 'preco_kg', parseFloat(e.target.value) || 0)} />
                <input className="form-input" placeholder="Fornecedor" value={item.fornecedor || ''} onChange={e => atualizarItem(item.id, 'fornecedor', e.target.value)} />
              </>
            )}
          </div>
        </div>
      ))}
      <button onClick={salvarTodos} disabled={salvando} style={{ width: '100%', padding: '12px', background: 'var(--verde)', color: 'var(--bg)', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 16, cursor: 'pointer', opacity: salvando ? 0.5 : 1 }}>
        {salvando ? '⏳ Salvando...' : `✅ CONFIRMAR TODOS (${itens.length} itens)`}
      </button>
    </div>}
  </>
}
