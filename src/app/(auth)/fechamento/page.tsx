'use client'
import { useState, useEffect, useRef } from 'react'
import { useAuth, fmtCurrency, todayStr } from '@/app/components/useAuth'
import { Loading, Modal } from '@/app/components/Shared'
import {
  Banknote, CreditCard, Smartphone, Ticket, Bike, TrendingUp, FileUp, Zap,
  CheckCircle2, Pencil, Trash2, Landmark, Calculator, Receipt, Users,
  Scale, Beef, BarChart3, Flame, ClipboardList, Save, FolderOpen, AlertTriangle,
  Clock, ArrowUpCircle, ArrowDownCircle,
} from 'lucide-react'

interface Carne { id: string; nome: string; quantidade_kg: number; preco_kg_compra: number; estoque_minimo_kg: number }
interface FechamentoAnterior { data: string; total_vendas: number; total_despesas: number; lucro: number; fechado: boolean; id?: string; vendas_dinheiro?: number; vendas_cartao_credito?: number; vendas_cartao_debito?: number; vendas_pix?: number; vendas_vale_refeicao?: number; vendas_delivery?: number; vendas_delivery_bruto?: number; observacoes?: string; fundo_caixa?: number; caixa_contado?: number; diferenca_caixa?: number }

const inputStyle = { width: '100%', padding: '8px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, marginTop: 4, boxSizing: 'border-box' as const } as const
const cardStyle = { background: 'var(--surface)', borderRadius: 12, padding: 14, border: '1px solid var(--border)', marginBottom: 14 } as const
const labelStyle = { fontSize: 11, color: 'var(--muted)' } as const

const SECOES: { key: string; label: string; Icon: any }[] = [
  { key: 'dinheiro', label: 'Dinheiro', Icon: Banknote },
  { key: 'credito', label: 'Cartão de Crédito', Icon: CreditCard },
  { key: 'debito', label: 'Cartão de Débito', Icon: CreditCard },
  { key: 'pix', label: 'Pix', Icon: Smartphone },
  { key: 'vale', label: 'Vale Refeição', Icon: Ticket },
  { key: 'delivery', label: 'Delivery / 99 Food', Icon: Bike },
]

export default function FechamentoPage() {
  const { apiGet, apiPost, apiPut, apiDelete, apiUpload, loading: authLoading } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)

  const [valores, setValores] = useState<Record<string, string>>({})
  const [deliveryBruto, setDeliveryBruto] = useState('')
  const [totalDespesas, setTotalDespesas] = useState('')
  const [fundoCaixa, setFundoCaixa] = useState('')
  const [caixaContado, setCaixaContado] = useState('')
  const [clientes, setClientes] = useState('')
  const [kgSelf, setKgSelf] = useState('')
  const [kgChurrasco, setKgChurrasco] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [carnes, setCarnes] = useState<Carne[]>([])
  const [pesosFinais, setPesosFinais] = useState<Record<string, string>>({})
  const [showCarnes, setShowCarnes] = useState(false)

  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [preenchendo, setPreenchendo] = useState(false)
  const [resumoDia, setResumoDia] = useState<{ receitas: number; despesas: number } | null>(null)
  const [saidasCaixa, setSaidasCaixa] = useState(0)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)
  const [historico, setHistorico] = useState<FechamentoAnterior[]>([])
  const [fechadoData, setFechadoData] = useState(false)
  const [config, setConfig] = useState<{ custo_diario?: number; tolerancia?: number } | null>(null)

  const hoje = todayStr()
  const [dataSel, setDataSel] = useState<string>(hoje)
  const hojeDisplay = new Date(dataSel + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })

  const [editando, setEditando] = useState<FechamentoAnterior | null>(null)
  const [editValores, setEditValores] = useState<Record<string, string>>({})
  const [editDeliveryBruto, setEditDeliveryBruto] = useState('')
  const [editDespesas, setEditDespesas] = useState('')
  const [editFundoCaixa, setEditFundoCaixa] = useState('')
  const [editCaixaContado, setEditCaixaContado] = useState('')
  const [editObs, setEditObs] = useState('')
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [excluindo, setExcluindo] = useState(false)

  useEffect(() => {
    if (authLoading) return
    const dataSeteDias = new Date(); dataSeteDias.setDate(dataSeteDias.getDate() - 30)
    const inicio = dataSeteDias.toISOString().slice(0, 10)
    Promise.all([
      apiGet('/api/churrasco/carnes'),
      apiGet(`/api/fechamento-dia?data_inicio=${inicio}&data_fim=${hoje}`),
    ]).then(([carnesData, historicoData]) => {
      if (carnesData) setCarnes(carnesData)
      if (historicoData) {
        setHistorico(historicoData as FechamentoAnterior[])
        const fechadoDataSel = (historicoData as FechamentoAnterior[]).find((f: any) => f.data === dataSel)
        if (fechadoDataSel) {
          setFechadoData(!!fechadoDataSel.fechado)
          preencherFormulario(fechadoDataSel as any)
        }
      }
      setCarregando(false)
    })
    carregarSaidasCaixa(hoje)
    apiGet('/api/configuracao').then(c => {
      if (c && !c.error) {
        const totalFixo = (c.aluguel_mensal || 0) + (c.funcionarios_mensal || 0) + (c.energia_mensal || 0) + (c.agua_mensal || 0) + (c.outros_fixos || 0)
        const dias = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
        setConfig({ custo_diario: dias > 0 ? totalFixo / dias : 0, tolerancia: parseFloat(c.tolerancia_caixa) || 0 })
      }
    })
  }, [authLoading])

  function preencherFormulario(f: any) {
    const n = (v: any) => v === null || v === undefined ? '' : String(v)
    setValores({
      dinheiro: n(f.vendas_dinheiro), credito: n(f.vendas_cartao_credito), debito: n(f.vendas_cartao_debito),
      pix: n(f.vendas_pix), vale: n(f.vendas_vale_refeicao), delivery: n(f.vendas_delivery),
    })
    setDeliveryBruto(n(f.vendas_delivery_bruto))
    setTotalDespesas(n(f.total_despesas))
    setFundoCaixa(n(f.fundo_caixa))
    setCaixaContado(n(f.caixa_contado))
    setClientes(n(f.clientes_atendidos))
    setKgSelf(n(f.kg_self_service))
    setKgChurrasco(n(f.kg_carnes_churrasco))
    setObservacoes(n(f.observacoes))
  }

  async function carregarSaidasCaixa(data: string) {
    try {
      const res = await apiGet(`/api/lancamentos?data_inicio=${data}&data_fim=${data}&limit=500`)
      const lista = res?.data || []
      const total = lista
        .filter((l: any) => l.tipo === 'despesa' && l.origem !== 'fechamento' && l.afeta_caixa !== false)
        .reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
      setSaidasCaixa(Math.round(total * 100) / 100)
    } catch { setSaidasCaixa(0) }
  }

  function limparFormulario() {
    setValores({}); setDeliveryBruto(''); setTotalDespesas(''); setFundoCaixa(''); setCaixaContado('')
    setClientes(''); setKgSelf(''); setKgChurrasco(''); setObservacoes('')
  }

  async function carregarData(data: string) {
    setCarregando(true); setMsg(null)
    try {
      carregarSaidasCaixa(data)
      const res = await apiGet(`/api/fechamento-dia?data_inicio=${data}&data_fim=${data}`)
      const lista = (Array.isArray(res) ? res : []) as any[]
      const f = lista.find((x: any) => x.data === data)
      if (f) {
        preencherFormulario(f)
        setFechadoData(!!f.fechado)
      } else {
        limparFormulario()
        setFechadoData(false)
      }
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao carregar o fechamento' }) }
    setCarregando(false)
  }

  function selecionarData(data: string) {
    setDataSel(data)
    carregarSaidasCaixa(data)
    if (data === hoje) {
      const f = historico.find(x => x.data === data)
      if (f) { preencherFormulario(f); setFechadoData(!!f.fechado); return }
    }
    carregarData(data)
  }

  const somaSecao = (k: string) => parseFloat(valores[k] || '') || 0
  const totalVendas = SECOES.reduce((s, x) => s + somaSecao(x.key), 0)
  const deliveryReal = somaSecao('delivery')
  const deliveryBrutoVal = parseFloat(deliveryBruto) || 0
  const deliveryTaxa = deliveryBrutoVal > 0 ? Math.round((1 - deliveryReal / deliveryBrutoVal) * 1000) / 10 : 0
  const despesas = parseFloat(totalDespesas) || 0
  const lucroBruto = totalVendas - despesas
  const fundoCaixaVal = parseFloat(fundoCaixa) || 0
  const caixaContadoVal = parseFloat(caixaContado) || 0
  const esperadoCaixa = Math.round((fundoCaixaVal + somaSecao('dinheiro') - saidasCaixa) * 100) / 100
  const diferencaCaixa = Math.round((caixaContadoVal - esperadoCaixa) * 100) / 100

  let custoConsumo = 0
  const detalhesConsumo: any[] = []
  if (showCarnes) {
    for (const carne of carnes) {
      const pesoFinal = parseFloat(pesosFinais[carne.id]) || carne.quantidade_kg
      const consumo = carne.quantidade_kg - pesoFinal
      if (consumo > 0) {
        const custo = consumo * carne.preco_kg_compra
        custoConsumo += custo
        detalhesConsumo.push({ nome: carne.nome, consumo, custo: Math.round(custo * 100) / 100 })
      }
    }
  }
  const lucroLiquido = Math.round((lucroBruto - custoConsumo) * 100) / 100

  const ultimoFechamento = historico.find(f => f.data < hoje && f.fechado)
  const comparativo = ultimoFechamento ? {
    vendas: Math.round((totalVendas - (ultimoFechamento.total_vendas || 0)) * 100) / 100,
    lucro: Math.round((lucroLiquido - (ultimoFechamento.lucro || 0)) * 100) / 100,
  } : null

  async function preencherDoDia() {
    setPreenchendo(true); setMsg(null)
    try {
      const res = await apiGet(`/api/lancamentos?data_inicio=${dataSel}&data_fim=${dataSel}&limit=500`)
      const lista = res?.data || []
      const receitas = lista.filter((l: any) => l.origem !== 'fechamento' && l.tipo === 'receita').reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
      const despesas = lista.filter((l: any) => l.tipo === 'despesa').reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
      const saidasCaixaDia = lista.filter((l: any) => l.tipo === 'despesa' && l.origem !== 'fechamento' && l.afeta_caixa !== false).reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
      setResumoDia({ receitas, despesas })
      setSaidasCaixa(Math.round(saidasCaixaDia * 100) / 100)
      if (despesas > 0) setTotalDespesas(String(despesas.toFixed(2)))
      setMsg({ tipo: 'ok', texto: `Preenchido com os lançamentos de ${dataSel}. Confira os valores.` })
    } catch { setMsg({ tipo: 'erro', texto: 'Erro ao buscar lançamentos do dia' }) }
    setPreenchendo(false)
  }

  async function importarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImportando(true); setMsg(null)
    try {
      const formData = new FormData()
      formData.append('arquivo', file)
      const res = await apiUpload('/api/importar/fechamento', formData)
      if (res?.error) throw new Error(res.error)
      const linhas: any[] = res?.linhas || []
      if (linhas.length === 0) { setMsg({ tipo: 'erro', texto: 'Nenhuma venda identificada no arquivo. Verifique o formato.' }); return }
      const novos: Record<string, number> = {}
      for (const l of linhas) novos[l.forma] = (novos[l.forma] || 0) + l.valor
      const novosState: Record<string, string> = {}
      for (const [forma, total] of Object.entries(novos)) {
        const key = forma === 'outros' ? 'delivery' : forma
        novosState[key] = String(((parseFloat(valores[key] || '') || 0) + total).toFixed(2))
      }
      setValores(prev => ({ ...prev, ...novosState }))
      setMsg({ tipo: 'ok', texto: `${linhas.length} venda(s) importada(s) do arquivo (${file.name}).` })
    } catch (err: any) { setMsg({ tipo: 'erro', texto: err?.message || 'Erro ao importar arquivo' }) }
    setImportando(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function fecharDia() {
    setSalvando(true); setMsg(null)
    try {
      const payload = {
        data: dataSel,
        vendas_dinheiro: somaSecao('dinheiro'),
        vendas_cartao_credito: somaSecao('credito'),
        vendas_cartao_debito: somaSecao('debito'),
        vendas_pix: somaSecao('pix'),
        vendas_vale_refeicao: somaSecao('vale'),
        vendas_delivery: somaSecao('delivery'),
        vendas_delivery_bruto: deliveryBrutoVal,
        total_despesas: despesas,
        lucro: lucroLiquido,
        fundo_caixa: fundoCaixaVal,
        caixa_contado: caixaContadoVal,
        clientes_atendidos: parseInt(clientes) || 0,
        kg_self_service: parseFloat(kgSelf) || 0,
        kg_carnes_churrasco: parseFloat(kgChurrasco) || 0,
        observacoes: observacoes || null,
      }
      const res = await apiPost('/api/fechamento-dia', payload)
      if (res?.error) throw new Error(res.error)
      setMsg({ tipo: 'ok', texto: `Fechamento de ${dataSel} registrado! Vendas no painel.` })
      setFechadoData(true)
      setHistorico(prev => [{ data: dataSel, total_vendas: totalVendas, total_despesas: despesas, lucro: lucroLiquido, fechado: true, fundo_caixa: fundoCaixaVal, caixa_contado: caixaContadoVal }, ...prev.filter(f => f.data !== dataSel)])
    } catch (err: any) { setMsg({ tipo: 'erro', texto: err?.message || 'Erro ao fechar dia' }) }
    setSalvando(false)
  }

  function abrirEdicao(f: FechamentoAnterior) {
    setEditando(f)
    setEditValores({
      dinheiro: String(f.vendas_dinheiro ?? 0), credito: String(f.vendas_cartao_credito ?? 0), debito: String(f.vendas_cartao_debito ?? 0),
      pix: String(f.vendas_pix ?? 0), vale: String(f.vendas_vale_refeicao ?? 0), delivery: String(f.vendas_delivery ?? 0),
    })
    setEditDeliveryBruto(String(f.vendas_delivery_bruto ?? 0))
    setEditDespesas(String(f.total_despesas ?? 0))
    setEditFundoCaixa(String(f.fundo_caixa ?? 0))
    setEditCaixaContado(String(f.caixa_contado ?? 0))
    setEditObs(f.observacoes || '')
  }

  function somaEdit() {
    let t = 0
    for (const k of ['dinheiro', 'credito', 'debito', 'pix', 'vale', 'delivery']) t += parseFloat(editValores[k]) || 0
    return t
  }

  async function salvarEdicao() {
    if (!editando?.id) { setMsg({ tipo: 'erro', texto: 'Fechamento sem id' }); return }
    setSalvandoEdit(true); setMsg(null)
    try {
      const payload = {
        vendas_dinheiro: parseFloat(editValores.dinheiro) || 0,
        vendas_cartao_credito: parseFloat(editValores.credito) || 0,
        vendas_cartao_debito: parseFloat(editValores.debito) || 0,
        vendas_pix: parseFloat(editValores.pix) || 0,
        vendas_vale_refeicao: parseFloat(editValores.vale) || 0,
        vendas_delivery: parseFloat(editValores.delivery) || 0,
        vendas_delivery_bruto: parseFloat(editDeliveryBruto) || 0,
        total_despesas: parseFloat(editDespesas) || 0,
        fundo_caixa: parseFloat(editFundoCaixa) || 0,
        caixa_contado: parseFloat(editCaixaContado) || 0,
        observacoes: editObs || null,
      }
      const res = await apiPut(`/api/fechamento-dia/${editando.id}`, payload)
      if (res?.error) throw new Error(res.error)
      const totalVendas = Object.keys(payload).slice(0, 6).reduce((s, k) => s + (payload as any)[k], 0)
      const lucro = totalVendas - (parseFloat(editDespesas) || 0)
      setHistorico(prev => prev.map(f => f.id === editando.id ? { ...f, total_vendas: totalVendas, total_despesas: parseFloat(editDespesas) || 0, lucro } : f))
      setEditando(null)
      setMsg({ tipo: 'ok', texto: 'Fechamento atualizado!' })
    } catch (err: any) { setMsg({ tipo: 'erro', texto: err?.message || 'Erro ao salvar' }) }
    setSalvandoEdit(false)
  }

  async function excluirFechamento() {
    if (!editando?.id) return
    if (!confirm(`Excluir o fechamento de ${editando.data}? Os lançamentos de venda também serão removidos.`)) return
    setExcluindo(true)
    try {
      const res = await apiDelete(`/api/fechamento-dia/${editando.id}`)
      if (res?.error) throw new Error(res.error)
      setHistorico(prev => prev.filter(f => f.id !== editando.id))
      if (editando.data === dataSel) setFechadoData(false)
      setEditando(null)
      setMsg({ tipo: 'ok', texto: 'Fechamento excluído' })
    } catch (err: any) { setMsg({ tipo: 'erro', texto: err?.message || 'Erro ao excluir' }) }
    setExcluindo(false)
  }

  if (authLoading || carregando) return <Loading />

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}><TrendingUp aria-hidden="true" size={17} color="var(--accent)" /> Fechamento do Dia</div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{hojeDisplay}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="date" value={dataSel} max={hoje}
          onChange={e => e.target.value && selecionarData(e.target.value)}
          style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13 }} />
        {dataSel !== hoje && <button onClick={() => selecionarData(hoje)} style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}>Hoje</button>}
        {fechadoData && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'oklch(55% 0.10 140 / 0.15)', color: 'var(--verde)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 aria-hidden="true" size={12} /> Fechado</span>}
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button onClick={() => fileRef.current?.click()} disabled={importando}
        style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {importando ? <><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 aria-hidden="true" size={14} /> Importando...</span></> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><FileUp aria-hidden="true" size={14} /> Importar CSV / PDF</span>}
      </button>
      <button onClick={preencherDoDia} disabled={preenchendo}
        style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
        {preenchendo ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><CheckCircle2 aria-hidden="true" size={14} /> ...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Zap aria-hidden="true" size={14} /> Preencher despesas</span>}
      </button>
    </div>
    <input ref={fileRef} type="file" accept=".csv,.txt,.pdf" style={{ display: 'none' }} onChange={importarArquivo} />

    <div style={cardStyle}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Vendas por Forma de Pagamento</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {SECOES.map(s => (
          <div key={s.key}>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
              <s.Icon aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> {s.label}
            </label>
            <input type="number" step="0.01" value={valores[s.key] || ''} onChange={e => setValores({ ...valores, [s.key]: e.target.value })} placeholder="0,00" style={inputStyle} />
          </div>
        ))}
      </div>
      <div style={{ marginTop: 8, padding: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)' }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Bike aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Delivery — Venda Bruta (o que o cliente pagou)</label>
        <input type="number" step="0.01" value={deliveryBruto} onChange={e => setDeliveryBruto(e.target.value)} placeholder="0,00" style={inputStyle} />
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
          {deliveryBrutoVal > 0 ? (
            <>Bruto <b style={{ color: 'var(--fg)' }}>{fmtCurrency(deliveryBrutoVal)}</b> • Real (repasse) <b style={{ color: 'var(--verde)' }}>{fmtCurrency(deliveryReal)}</b> • Taxas 99Food <b style={{ color: 'var(--vermelho)' }}>{deliveryTaxa}%</b> ({fmtCurrency(deliveryBrutoVal - deliveryReal)})
              <br />Custo total das taxas: <b style={{ color: 'var(--vermelho)' }}>{fmtCurrency(deliveryBrutoVal - deliveryReal)}</b></>
          ) : (
            <>Informe a venda bruta do delivery acima para calcular a taxa de desconto do 99Food</>
          )}
        </div>
      </div>
      {resumoDia && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>
        Lançamentos de {dataSel}: despesas <b style={{ color: 'var(--vermelho)' }}>{fmtCurrency(resumoDia.despesas)}</b>
        {resumoDia.receitas > 0 && <> • receitas registradas <b style={{ color: 'var(--verde)' }}>{fmtCurrency(resumoDia.receitas)}</b></>}
      </div>}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 16, fontWeight: 700 }}>
        <span>Total Vendas</span>
        <span style={{ color: 'var(--verde)' }}>{fmtCurrency(totalVendas)}</span>
      </div>
    </div>

    {fechadoData ? (
      <div style={{ ...cardStyle, textAlign: 'center', borderColor: 'var(--verde)' }}>
        <div style={{ fontSize: 32, marginBottom: 8, display: 'flex', justifyContent: 'center' }}><CheckCircle2 aria-hidden="true" size={36} color="var(--verde)" /></div>
        <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--verde)' }}>Dia fechado com {fmtCurrency(totalVendas)} em vendas</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Você pode refazer ou editar o fechamento desta data.</div>
        <button onClick={() => { setFechadoData(false); setMsg(null) }}
          style={{ marginTop: 12, padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Pencil aria-hidden="true" size={12} /> Refazer / Editar fechamento
        </button>
      </div>
    ) : <>
      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Banknote aria-hidden="true" size={14} color="var(--amarelo)" /> Fundo de Caixa</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Landmark aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Fundo de caixa (troco inicial)</label>
            <input type="number" step="0.01" value={fundoCaixa} onChange={e => setFundoCaixa(e.target.value)} placeholder="0,00" style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Calculator aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Caixa contado no fim do dia</label>
            <input type="number" step="0.01" value={caixaContado} onChange={e => setCaixaContado(e.target.value)} placeholder="0,00" style={inputStyle} />
          </div>
        </div>
        {(fundoCaixaVal > 0 || caixaContadoVal > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border)', fontSize: 12 }}>
            <span style={{ color: 'var(--muted)' }}>
              Esperado em caixa (fundo + dinheiro{saidasCaixa > 0 ? ` − despesas do caixa ${fmtCurrency(saidasCaixa)}` : ''}):
            </span>
            <span style={{ fontWeight: 700 }}>{fmtCurrency(esperadoCaixa)}</span>
          </div>
        )}
        {caixaContadoVal > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
            <span style={{ color: 'var(--muted)' }}>Diferença (sobra/falta):</span>
            <span style={{ fontWeight: 700, color: diferencaCaixa === 0 ? 'var(--verde)' : (diferencaCaixa > 0 ? 'var(--verde)' : 'var(--vermelho)') }}>
              {diferencaCaixa === 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 aria-hidden="true" size={12} /> Caixa certo</span> : (diferencaCaixa > 0
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowUpCircle aria-hidden="true" size={12} /> Sobrou {fmtCurrency(diferencaCaixa)}</span>
                  : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowDownCircle aria-hidden="true" size={12} /> Faltou {fmtCurrency(Math.abs(diferencaCaixa))}</span>)}
            </span>
          </div>
        )}
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Despesas do Dia</div>
        <div>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Receipt aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Total Despesas (R$)</label>
          <input type="number" step="0.01" value={totalDespesas} onChange={e => setTotalDespesas(e.target.value)} placeholder="0,00" style={inputStyle} />
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Clientes e Volume</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Users aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> Clientes</label>
            <input type="number" value={clientes} onChange={e => setClientes(e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Scale aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> KG Self-Service</label>
            <input type="number" step="0.1" value={kgSelf} onChange={e => setKgSelf(e.target.value)} placeholder="0,0" style={inputStyle} />
          </div>
          <div>
            <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}><Beef aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> KG Churrasco</label>
            <input type="number" step="0.1" value={kgChurrasco} onChange={e => setKgChurrasco(e.target.value)} placeholder="0,0" style={inputStyle} />
          </div>
        </div>
      </div>

      {carnes.length > 0 && (
        <div style={cardStyle}>
          <div onClick={() => setShowCarnes(!showCarnes)} style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer' }}>
            <span style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Beef aria-hidden="true" size={14} style={{ color: 'var(--muted)' }} /> Baixa de Estoque (Carnes)</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>{showCarnes ? '▲' : '▼'}</span>
          </div>
          {showCarnes && <>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8, marginBottom: 10 }}>Informe o peso final de cada carne para calcular o consumo</div>
            {carnes.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{c.nome}</div>
                  <div style={{ fontSize: 10, color: 'var(--muted)' }}>Atual: {c.quantidade_kg}kg — Mín: {c.estoque_minimo_kg}kg</div>
                </div>
                <input type="number" step="0.1" value={pesosFinais[c.id] || ''}
                  onChange={e => setPesosFinais({ ...pesosFinais, [c.id]: e.target.value })}
                  placeholder="Final kg"
                  style={{ width: 80, padding: '6px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12, textAlign: 'right' }} />
              </div>
            ))}
          </>}
        </div>
      )}

      <div style={cardStyle}>
        <label style={labelStyle}>Observações</label>
        <input value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Opcional" style={inputStyle} />
      </div>

      {(totalVendas > 0 || despesas > 0 || custoConsumo > 0) && (
        <div style={{ ...cardStyle, borderColor: 'var(--accent)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><BarChart3 aria-hidden="true" size={15} color="var(--accent)" /> Resultado do Dia</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>Vendas (todas as formas)</span><span style={{ color: 'var(--verde)' }}>{fmtCurrency(totalVendas)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>Despesas</span><span style={{ color: 'var(--vermelho)' }}>-{fmtCurrency(despesas)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
            <span>Lucro Bruto</span>
            <span style={{ color: lucroBruto >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(lucroBruto)}</span>
          </div>
          {detalhesConsumo.length > 0 && <>
            <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
            <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>Consumo de Carnes:</div>
            {detalhesConsumo.map((d, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2, paddingLeft: 8 }}>
                <span>{d.nome}: {d.consumo.toFixed(1)}kg</span><span style={{ color: 'var(--vermelho)' }}>-{fmtCurrency(d.custo)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4 }}>
              <span>Custo Consumo</span><span style={{ color: 'var(--vermelho)' }}>-{fmtCurrency(custoConsumo)}</span>
            </div>
          </>}
          {config?.custo_diario ? (function() {
            const meta = config.custo_diario!
            const coberto = totalVendas >= meta
            const metaTolerancia = config.tolerancia ? meta + config.tolerancia : 0
            return <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0', paddingTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--muted)' }}><Flame aria-hidden="true" size={12} style={{ color: 'var(--muted)' }} /> Break-even diário (custos fixos)</span><span style={{ fontWeight: 600, color: coberto ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(meta)}</span>
              </div>
              {coberto && <div style={{ fontSize: 11, color: 'var(--verde)', display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle2 aria-hidden="true" size={12} /> Vendas cobrem os custos fixos de hoje.</div>}
              {!coberto && <div style={{ fontSize: 11, color: 'var(--vermelho)', display: 'flex', alignItems: 'center', gap: 4 }}><AlertTriangle aria-hidden="true" size={12} /> Faltam {fmtCurrency(meta - totalVendas)} p/ cobrir custos fixos.</div>}
              {config.tolerancia ? <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>Faixa de tolerância: até {fmtCurrency(metaTolerancia)}.</div> : null}
            </div>
          })() : null}
          <div style={{ borderTop: '1px solid var(--border)', margin: '6px 0' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700 }}>
            <span>Lucro Líquido</span>
            <span style={{ color: lucroLiquido >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(lucroLiquido)}</span>
          </div>
          {comparativo && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: 'var(--muted)' }}>
              <span>vs. último fechamento</span>
              <span style={{ color: comparativo.vendas >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>
                Vendas: {comparativo.vendas >= 0 ? '+' : ''}{fmtCurrency(comparativo.vendas)} / Lucro: {comparativo.lucro >= 0 ? '+' : ''}{fmtCurrency(comparativo.lucro)}
              </span>
            </div>
          )}
          {clientes && parseInt(clientes) > 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              Ticket médio: {fmtCurrency(totalVendas / parseInt(clientes))} • KG médio: {kgSelf ? (parseFloat(kgSelf) / parseInt(clientes)).toFixed(2) : '-'}kg
            </div>
          )}
        </div>
      )}

      {msg && (
        <div style={{ padding: 8, borderRadius: 8, background: msg.tipo === 'ok' ? 'oklch(85% 0.15 145 / 0.1)' : 'oklch(75% 0.15 25 / 0.1)', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
          {msg.texto}
        </div>
      )}

      <button onClick={fecharDia} disabled={salvando || totalVendas <= 0}
        style={{ width: '100%', height: 48, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: (salvando || totalVendas <= 0) ? 0.5 : 1 }}>
        {salvando ? 'Salvando...' : totalVendas > 0 ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 aria-hidden="true" size={17} /> Fechar Dia — {fmtCurrency(totalVendas)}</span> : 'Informe as vendas do dia'}
      </button>
    </>}

    {historico.filter(f => f.fechado).length > 1 && (
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><FolderOpen aria-hidden="true" size={14} style={{ color: 'var(--muted)' }} /> Últimos Fechamentos</div>
        {historico.filter(f => f.fechado).slice(0, 7).map(f => (
          <div key={f.data} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => selecionarData(f.data)}>
            <span style={{ flex: 1, color: 'var(--muted)' }}>{new Date(f.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
            {f.vendas_delivery ? <span title={`Delivery: bruto ${fmtCurrency(f.vendas_delivery_bruto || 0)} / real ${fmtCurrency(f.vendas_delivery)}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Bike aria-hidden="true" size={12} style={{ color: 'var(--muted)' }} /> {fmtCurrency(f.vendas_delivery)}</span> : null}
            <span>Vendas: {fmtCurrency(f.total_vendas || 0)}</span>
            <span style={{ color: (f.lucro || 0) >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(f.lucro || 0)}</span>
            <span style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
              <button onClick={() => abrirEdicao(f)} aria-label="Editar fechamento" style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 6px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Pencil aria-hidden="true" size={12} /></button>
              <button onClick={() => abrirEdicao(f)} aria-label="Excluir fechamento" style={{ background: 'transparent', border: '1px solid var(--vermelho)', borderRadius: 5, padding: '2px 6px', cursor: 'pointer', fontSize: 11, color: 'var(--vermelho)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 aria-hidden="true" size={12} /></button>
            </span>
          </div>
        ))}
      </div>
    )}

    {editando && (
      <Modal titulo={`Editar Fechamento — ${new Date(editando.data + 'T12:00:00').toLocaleDateString('pt-BR')}`} onClose={() => setEditando(null)}>
        <div style={{ display: 'grid', gap: 8 }}>
          {[{ key: 'dinheiro', Icon: Banknote, txt: 'Dinheiro' }, { key: 'credito', Icon: CreditCard, txt: 'Crédito' }, { key: 'debito', Icon: CreditCard, txt: 'Débito' }, { key: 'pix', Icon: Smartphone, txt: 'Pix' }, { key: 'vale', Icon: Ticket, txt: 'Vale' }, { key: 'delivery', Icon: Bike, txt: 'Delivery' }].map(({ key: k, Icon: EIcon, txt }) => (
            <div key={k}>
              <label style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <EIcon aria-hidden="true" size={13} style={{ color: 'var(--muted)' }} /> {txt}
              </label>
              <input className="form-input" type="number" step="0.01" value={editValores[k] || ''} onChange={e => setEditValores(prev => ({ ...prev, [k]: e.target.value }))} style={{ marginTop: 2 }} />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Delivery — Venda Bruta (cliente pagou)</label>
            <input className="form-input" type="number" step="0.01" value={editDeliveryBruto} onChange={e => setEditDeliveryBruto(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Total Despesas</label>
            <input className="form-input" type="number" step="0.01" value={editDespesas} onChange={e => setEditDespesas(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Fundo de Caixa (troco inicial)</label>
            <input className="form-input" type="number" step="0.01" value={editFundoCaixa} onChange={e => setEditFundoCaixa(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Caixa contado no fim do dia</label>
            <input className="form-input" type="number" step="0.01" value={editCaixaContado} onChange={e => setEditCaixaContado(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div>
            <label style={{ fontSize: 11, color: 'var(--muted)' }}>Observações</label>
            <input className="form-input" value={editObs} onChange={e => setEditObs(e.target.value)} style={{ marginTop: 2 }} />
          </div>
          <div style={{ textAlign: 'center', padding: 8, background: 'var(--bg)', borderRadius: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>Total Vendas: </span>
            <span style={{ fontWeight: 700, color: 'var(--verde)' }}>{fmtCurrency(somaEdit())}</span>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>Lucro: </span>
            <span style={{ fontWeight: 700, color: somaEdit() - (parseFloat(editDespesas) || 0) >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(somaEdit() - (parseFloat(editDespesas) || 0))}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setEditando(null)} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--fg)', cursor: 'pointer' }}>Cancelar</button>
            <button onClick={salvarEdicao} disabled={salvandoEdit} className="btn btn-primary" style={{ flex: 2 }}>{salvandoEdit ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock aria-hidden="true" size={15} /> ...</span> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Save aria-hidden="true" size={15} /> Salvar</span>}</button>
            <button onClick={excluirFechamento} disabled={excluindo} style={{ flex: 1, borderRadius: 8, border: '1px solid var(--vermelho)', background: 'var(--vermelho)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{excluindo ? <Clock aria-hidden="true" size={15} /> : <Trash2 aria-hidden="true" size={15} />}</button>
          </div>
        </div>
      </Modal>
    )}
  </>
}
