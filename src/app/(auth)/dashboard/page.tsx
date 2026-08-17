'use client'
import { useState, useEffect } from 'react'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { EmptyState, Modal } from '@/app/components/Shared'
import MarketTicker from '@/app/components/MarketTicker'
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, RefreshCw, NotebookPen, TrendingUp, Clock, CheckCircle2,
  AlertTriangle, Beef, Plus, CreditCard, Coins, Target, Flame, TrendingDown,
  CalendarClock, Sparkles, ArrowUpCircle, ArrowDownCircle, Send, BarChart3,
  LineChart as LineChartIcon,
} from 'lucide-react'

const CORES_PIE = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#1abc9c', '#e67e22', '#7f8c8d']

function hojeBR() { const d = new Date(); d.setHours(d.getHours() - 3); return d.toISOString().slice(0, 10) }

export default function DashboardPage() {
  const router = useRouter()
  const qc = useQueryClient()
  const { loading: authLoading, apiGet, apiPost } = useAuth()
  const [iaQuery, setIaQuery] = useState('')
  const [iaResp, setIaResp] = useState('')
  const [iaLoading, setIaLoading] = useState(false)
  const [pagandoConta, setPagandoConta] = useState<any>(null)
  const [pgData, setPgData] = useState(hojeBR())

  useEffect(() => {
    if (authLoading) return
    const hojeChave = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('panela_notificado') === hojeChave) return
    localStorage.setItem('panela_notificado', hojeChave)
    apiGet('/api/notificacoes/verificar').then((r: any) => {
      if (r?.enviado === true) toast.success('🔔 Notificações enviadas!')
    }).catch(() => {})
  }, [authLoading])

  const mes = new Date().toISOString().slice(0, 7)

  const resumoQ = useQuery({
    queryKey: ['gestao', mes],
    queryFn: () => apiGet(`/api/gestao/resumo?mes=${mes}`),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const evolucaoQ = useQuery({
    queryKey: ['evolucao', 7],
    queryFn: () => apiGet('/api/lancamentos/evolucao?dias=7'),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const lancHojeQ = useQuery({
    queryKey: ['lancamentos', 'hoje'],
    queryFn: () => apiGet(`/api/lancamentos?data_inicio=${hojeBR()}&data_fim=${hojeBR()}&limit=500`),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const contasQ = useQuery({
    queryKey: ['contas-pagar', 'pendente'],
    queryFn: () => apiGet('/api/contas-a-pagar?status=pendente'),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const mensalQ = useQuery({
    queryKey: ['evolucao-mensal'],
    queryFn: () => apiGet('/api/lancamentos/evolucao-mensal?meses=6'),
    enabled: !authLoading,
  })
  const fat30Q = useQuery({
    queryKey: ['faturamento-30d'],
    queryFn: () => apiGet('/api/gestao/faturamento-30d'),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const carnesQ = useQuery({
    queryKey: ['carnes'],
    queryFn: () => apiGet('/api/churrasco/carnes'),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const fechamentoQ = useQuery({
    queryKey: ['fechamento', hojeBR()],
    queryFn: () => apiGet(`/api/fechamento-dia?data_inicio=${hojeBR()}&data_fim=${hojeBR()}`),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const configQ = useQuery({
    queryKey: ['configuracao'],
    queryFn: () => apiGet('/api/configuracao'),
    enabled: !authLoading,
    refetchInterval: 60000,
  })
  const semanaQ = useQuery({
    queryKey: ['resumo-semana'],
    queryFn: () => apiGet('/api/lancamentos/resumo-semana?data=' + hojeBR()),
    enabled: !authLoading,
    refetchInterval: 60000,
  })

  async function refrescar() {
    await Promise.all([
      qc.refetchQueries({ queryKey: ['gestao'] }),
      qc.refetchQueries({ queryKey: ['evolucao'] }),
      qc.refetchQueries({ queryKey: ['lancamentos'] }),
      qc.refetchQueries({ queryKey: ['contas-pagar'] }),
      qc.refetchQueries({ queryKey: ['evolucao-mensal'] }),
      qc.refetchQueries({ queryKey: ['carnes'] }),
      qc.refetchQueries({ queryKey: ['fechamento'] }),
      qc.refetchQueries({ queryKey: ['faturamento-30d'] }),
      qc.refetchQueries({ queryKey: ['configuracao'] }),
      qc.refetchQueries({ queryKey: ['resumo-semana'] }),
    ])
    toast.success('Dados atualizados!')
  }

  const pagarMutation = useMutation({
    mutationFn: async ({ id, valor, data }: { id: string; desc: string; valor: number; data: string }) => {
      const res = await apiPost(`/api/contas-a-pagar/${id}/pagar`, { valor, data_pagamento: data })
      if (res?.error) throw new Error(res.error)
    },
    onSuccess: () => { toast.success('Conta paga!'); qc.invalidateQueries({ queryKey: ['contas-pagar'] }); qc.invalidateQueries({ queryKey: ['gestao'] }); qc.invalidateQueries({ queryKey: ['lancamentos'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const resumo = resumoQ.data
  const evolucao: any[] = evolucaoQ.data?.data || []
  const lancHoje: any[] = lancHojeQ.data?.data || []
  const contas: any[] = contasQ.data || []
  const evolucaoMensal: any[] = mensalQ.data || []
  const carnes: any[] = carnesQ.data || []
  const fat30 = fat30Q.data || null

  const loading = authLoading || resumoQ.isLoading

  const fechadosHoje: any[] = fechamentoQ.data || []
  const fechadoHoje = fechadosHoje.find((f: any) => f.fechado)
  const fechamentoPendente = !fechadoHoje

  const vendasHoje = fechadoHoje ? (parseFloat(fechadoHoje.total_vendas) || 0) : lancHoje.filter((l: any) => l.tipo === 'receita').reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
  const despesasHoje = lancHoje.filter((l: any) => l.tipo === 'despesa').reduce((s: number, l: any) => s + parseFloat(l.valor || 0), 0)
  const resultadoHoje = Math.round((vendasHoje - despesasHoje) * 100) / 100
  const breakEvenHoje = resumo?.break_even_diario || 0
  const acimaBreak = breakEvenHoje > 0 && vendasHoje >= breakEvenHoje
  const metaDiaria = parseFloat(configQ.data?.meta_diaria_vendas) || 0
  const acimaMeta = metaDiaria > 0 && vendasHoje >= metaDiaria
  const estoqueBaixo = carnes.filter((c: any) => c.quantidade_kg < (c.estoque_minimo_kg || 0))

  const tresDias = new Date(); tresDias.setDate(tresDias.getDate() + 3)
  const contas3d = contas.filter((c: any) => c.data_vencimento <= tresDias.toISOString().slice(0, 10))
  const totalVencer = contas3d.reduce((s: number, c: any) => s + parseFloat(c.valor || 0), 0)

  const ranking = resumo?.ranking_viloes || []
  const faturamento = resumo?.faturamento_mes || 0
  const despesasTotais = resumo?.total_despesas_mes || 0
  const lucroLiquido = resumo?.lucro_liquido || 0
  const margem = resumo?.margem_lucro || 0
  const mesAnterior = resumo?.mes_anterior || null
  const contasVencer = contas.slice(0, 5)

  const semana = semanaQ.data || null

  const deltaMes = (atual: number, ant: number | undefined) => ant && ant > 0 ? Math.round((atual / ant - 1) * 100) : null
  const DeltaBadge = ({ pct }: { pct: number | null }) => pct === null ? <></> : (
    <span style={{ fontSize: 10, fontWeight: 700, color: pct >= 0 ? 'var(--verde)' : 'var(--vermelho)', background: pct >= 0 ? 'oklch(55% 0.10 140 / 0.15)' : 'oklch(55% 0.17 28 / 0.15)', borderRadius: 20, padding: '2px 7px', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {pct >= 0 ? <ArrowUpCircle aria-hidden="true" size={11} /> : <ArrowDownCircle aria-hidden="true" size={11} />} {Math.abs(pct)}%
    </span>
  )

  if (!authLoading && (resumoQ.isError || evolucaoQ.isError || lancHojeQ.isError || contasQ.isError)) {
    toast.error('Erro ao carregar dados')
  }

  if (loading) return <div style={{ display: 'grid', gap: 14 }}>
    <div className="skeleton-line" style={{ width: 200, height: 18 }} />
    <div className="skeleton-line" style={{ width: 300, height: 44, borderRadius: 10 }} />
    <div className="skeleton-line" style={{ width: '100%', height: 54, borderRadius: 12 }} />
    <div className="skeleton-card" />
    <div className="skeleton-card" />
    <div className="skeleton-line" style={{ width: '100%', height: 160, borderRadius: 12 }} />
  </div>

  return <>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LayoutDashboard aria-hidden="true" size={18} color="var(--accent)" />
          Painel do Restaurante
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 5 }}><span className="live-dot" /> Ao vivo</span>
        <button onClick={refrescar} className="btn" style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
          <RefreshCw aria-hidden="true" size={13} /> Atualizar
        </button>
      </div>
    </div>

    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button onClick={() => router.push('/novo-lancamento')} className="btn btn-primary" style={{ flex: 1, height: 44, borderRadius: 10, fontWeight: 700, gap: 6 }}>
        <NotebookPen aria-hidden="true" size={18} /> Lançar agora
      </button>
      <button onClick={() => router.push('/fechamento')} className="btn" style={{ flex: 1, height: 44, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--fg)', fontWeight: 600, gap: 6 }}>
        {fechadoHoje ? <><TrendingUp aria-hidden="true" size={17} /> Ver fechamento</> : <><Clock aria-hidden="true" size={17} /> Fechar dia</>}
      </button>
    </div>

    {semana && <div className="hero-semana">
      <div className="hero-col hero-col-past">
        <div className="hero-tag">{new Date(semana.semana_passada.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit' })}</div>
        {semana.semana_passada.vazio ? (
          <div className="hero-vazio" style={{ color: 'var(--muted)' }}>Sem dados<br />{semana.semana_passada.data.slice(8, 10)}/{semana.semana_passada.data.slice(5, 7)}</div>
        ) : (<>
          <div className="hero-lbl">Vendas</div>
          <div className="hero-vendas hero-past">{fmtCurrency(semana.semana_passada.vendas)}</div>
          <div className="hero-lbl" style={{ marginTop: 8 }}>Resultado</div>
          <div className={`hero-resultado ${semana.semana_passada.resultado >= 0 ? 'positivo' : 'negativo'}`}>{fmtCurrency(semana.semana_passada.resultado)}</div>
        </>)}
      </div>
      <div className="hero-vs">
        <div className={`hero-vs-badge ${semana.comparativo.vendas >= 0 ? 'up' : 'down'}`}>
          {semana.comparativo.vendas >= 0 ? <ArrowUpCircle aria-hidden="true" size={16} /> : <ArrowDownCircle aria-hidden="true" size={16} />}
          {semana.semana_passada.vendas > 0 ? Math.round(Math.abs(semana.comparativo.vendas / semana.semana_passada.vendas) * 100) : 100}%
        </div>
        <span style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center' }}>vs<br />semana passada</span>
      </div>
      <div className="hero-col">
        <div className="hero-tag"><span className="live-dot" /> Hoje · {new Date(semana.hoje.data + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' })}</div>
        {semana.hoje.vazio && !fechadoHoje ? (
          <div className="hero-vazio"><Clock aria-hidden="true" size={14} color="var(--amarelo)" /> Sem lançamentos<br />ainda hoje</div>
        ) : (<>
          <div className="hero-lbl">Vendas</div>
          <div className="hero-vendas">{fmtCurrency(semana.hoje.vendas)}</div>
          <div className="hero-lbl" style={{ marginTop: 8 }}>Resultado</div>
          <div className={`hero-resultado ${semana.hoje.resultado >= 0 ? 'positivo' : 'negativo'}`}>{fmtCurrency(semana.hoje.resultado)}</div>
        </>)}
      </div>
    </div>}

    <div onClick={() => router.push('/fechamento')} style={{ background: fechadoHoje ? 'oklch(55% 0.10 140 / 0.15)' : 'oklch(75% 0.15 55 / 0.15)', border: `1px solid ${fechadoHoje ? 'var(--verde)' : 'var(--amarelo)'}`, borderRadius: 12, padding: 12, marginBottom: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>FECHAMENTO DE HOJE</div>
        {fechadoHoje ? (
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--verde)', display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 aria-hidden="true" size={18} /> Dia fechado — {fmtCurrency(fechadoHoje.total_vendas)}</div>
        ) : (
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--amarelo)', display: 'flex', alignItems: 'center', gap: 6 }}><Clock aria-hidden="true" size={18} /> Fechamento pendente</div>
        )}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>{fechadoHoje ? 'Ver →' : 'Fechar agora →'}</span>
    </div>

    <div className="smart-resumo">
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}><Sparkles aria-hidden="true" size={11} color="var(--amarelo)" /> Resumo rápido</div>
      {metaDiaria > 0 && (
        <div className="smart-resumo-item">
          <span className="smart-resumo-icon" style={{ background: acimaMeta ? 'oklch(55% 0.10 140 / 0.18)' : 'oklch(75% 0.15 55 / 0.18)' }}>{acimaMeta ? <ArrowUpCircle aria-hidden="true" size={12} color="var(--verde)" /> : <Target aria-hidden="true" size={12} color="var(--amarelo)" />}</span>
          <span>{acimaMeta ? <><strong style={{ color: 'var(--verde)' }}>Meta batida!</strong> Vendeu <strong>{fmtCurrency(vendasHoje)}</strong> de {fmtCurrency(metaDiaria)}.</> : <>Faltam <strong style={{ color: 'var(--amarelo)' }}>{fmtCurrency(Math.max(metaDiaria - vendasHoje, 0))}</strong> pra bater a meta de {fmtCurrency(metaDiaria)}.</>}</span>
        </div>
      )}
      {breakEvenHoje > 0 && (
        <div className="smart-resumo-item">
          <span className="smart-resumo-icon" style={{ background: acimaBreak ? 'oklch(55% 0.10 140 / 0.18)' : 'oklch(50% 0.17 28 / 0.18)' }}>{acimaBreak ? <CheckCircle2 aria-hidden="true" size={12} color="var(--verde)" /> : <Flame aria-hidden="true" size={12} color="var(--vermelho)" />}</span>
          <span>{acimaBreak ? <>Vendas <strong style={{ color: 'var(--verde)' }}>cobrem os custos fixos</strong>.</> : <>Abaixo do break-even ({fmtCurrency(breakEvenHoje)}) — faltam <strong style={{ color: 'var(--vermelho)' }}>{fmtCurrency(Math.max(breakEvenHoje - vendasHoje, 0))}</strong>.</>}</span>
        </div>
      )}
      {totalVencer > 0 && (
        <div className="smart-resumo-item">
          <span className="smart-resumo-icon" style={{ background: 'oklch(50% 0.17 28 / 0.18)' }}><CalendarClock aria-hidden="true" size={12} color="var(--vermelho)" /></span>
          <span><strong style={{ color: 'var(--vermelho)' }}>{contas3d.length === 1 ? '1 conta vence' : `${contas3d.length} contas vencem`} em 3 dias</strong>: {fmtCurrency(totalVencer)}.</span>
        </div>
      )}
      {estoqueBaixo.length > 0 && (
        <div className="smart-resumo-item">
          <span className="smart-resumo-icon" style={{ background: 'oklch(50% 0.17 28 / 0.18)' }}><Beef aria-hidden="true" size={12} color="var(--vermelho)" /></span>
          <span>Estoque baixo: <strong style={{ color: 'var(--vermelho)' }}>{estoqueBaixo.map((c: any) => c.nome).join(', ')}</strong>.</span>
        </div>
      )}
      {fechamentoPendente && (
        <div className="smart-resumo-item">
          <span className="smart-resumo-icon" style={{ background: 'oklch(60% 0.13 45 / 0.18)' }}><Clock aria-hidden="true" size={12} color="var(--amarelo)" /></span>
          <span>Dia ainda não <strong>fechado</strong>.</span>
        </div>
      )}
    </div>

    <MarketTicker />

    {fat30 && <div className="section" style={{ marginBottom: 14, borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 13 }}><Coins aria-hidden="true" size={16} color="var(--accent)" /> Faturado (30 dias)</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--verde)', padding: '3px 8px', background: 'oklch(55% 0.10 140 / 0.15)', borderRadius: 20 }}>{fat30.dias_com_venda || 0} dias com venda</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <div style={{ fontSize: 30, fontWeight: 800, color: 'var(--verde)', letterSpacing: '-0.02em' }}>{fmtCurrency(fat30.total_faturado)}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Despesas</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--vermelho)' }}>-{fmtCurrency(fat30.total_despesas)}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Saldo líquido</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: fat30.saldo_liquido >= 0 ? 'var(--verde)' : 'var(--vermelho)' }}>{fmtCurrency(fat30.saldo_liquido)}</div>
        </div>
      </div>
      {(fat30.detalhe || []).slice(0, 4).map((d: any) => (
        <div key={d.dia} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '4px 0', borderTop: '1px solid var(--border)', color: 'var(--muted)', marginTop: 2 }}>
          <span>{new Date(d.dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
          <span style={{ color: 'var(--verde)', fontWeight: 600 }}>{fmtCurrency(d.receitas)}</span>
        </div>
      ))}
    </div>}

    {estoqueBaixo.length > 0 && <div className="section" style={{ marginBottom: 14, borderColor: 'var(--vermelho)' }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: 'var(--vermelho)', display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle aria-hidden="true" size={15} /> Estoque Baixo</div>
      {estoqueBaixo.map(c => (
        <div key={c.id} onClick={() => router.push('/churrasco')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12, cursor: 'pointer' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Beef aria-hidden="true" size={14} style={{ color: 'var(--muted)' }} />
            {c.nome}: <strong>{c.quantidade_kg.toFixed(1)} kg</strong> (mín {c.estoque_minimo_kg} kg)
          </span>
          <span style={{ color: 'var(--vermelho)', fontWeight: 600 }}>Repor →</span>
        </div>
      ))}
    </div>}

    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>Resumo do Mês</div>
      <div className="summary-grid">
        <div className="summary-card"><div className="summary-sub">Faturamento</div><div className="summary-value accent" style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>{fmtCurrency(faturamento)}<DeltaBadge pct={deltaMes(faturamento, mesAnterior?.faturamento)} /></div></div>
        <div className="summary-card"><div className="summary-sub">Despesas</div><div className="summary-value vermelho">{fmtCurrency(despesasTotais)}</div><div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>{Math.round(despesasTotais) > 0 ? `${Math.round(faturamento > 0 ? despesasTotais / faturamento * 100 : 0)}% do faturamento` : 'sem despesas'}</div></div>
        <div className="summary-card"><div className="summary-sub">Lucro</div><div className={`summary-value ${lucroLiquido >= 0 ? 'verde' : 'vermelho'}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>{fmtCurrency(lucroLiquido)}<DeltaBadge pct={deltaMes(lucroLiquido, mesAnterior?.lucro_liquido)} /></div></div>
        <div className="summary-card"><div className="summary-sub">Margem</div><div className={`summary-value ${margem >= 0 ? 'verde' : 'vermelho'}`}>{margem}%</div><div style={{ marginTop: 4, fontSize: 10, color: 'var(--muted)' }}>lucro / faturamento</div></div>
      </div>
    </div>

    {mesAnterior && (mesAnterior.faturamento > 0 || mesAnterior.lucro_liquido !== 0) && <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingDown aria-hidden="true" size={15} color="var(--amarelo)" /> vs. Mês Passado</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
        <span>Faturamento</span>
        <span style={{ color: faturamento >= mesAnterior.faturamento ? 'var(--verde)' : 'var(--vermelho)', fontWeight: 600 }}>
          {fmtCurrency(faturamento - mesAnterior.faturamento)} {faturamento > 0 && mesAnterior.faturamento > 0 ? `(${Math.round((faturamento / mesAnterior.faturamento - 1) * 100)}%)` : ''}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
        <span>Lucro</span>
        <span style={{ color: lucroLiquido >= mesAnterior.lucro_liquido ? 'var(--verde)' : 'var(--vermelho)', fontWeight: 600 }}>
          {fmtCurrency(lucroLiquido - mesAnterior.lucro_liquido)}
        </span>
      </div>
    </div>}

    {metaDiaria > 0 && <div className="section" style={{ marginBottom: 16, borderColor: acimaMeta ? 'var(--verde)' : 'var(--accent)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Target aria-hidden="true" size={15} color="var(--accent)" /> Meta Diária de Vendas</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: acimaMeta ? 'var(--verde)' : 'var(--amarelo)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {acimaMeta ? <><CheckCircle2 aria-hidden="true" size={13} /> Meta atingida</> : `${Math.round(vendasHoje / metaDiaria * 100)}% da meta`}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{fmtCurrency(vendasHoje)}<span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}> / {fmtCurrency(metaDiaria)}</span></div>
      <div style={{ height: 8, background: 'var(--bg)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ height: '100%', borderRadius: 8, transform: `scaleX(${Math.min(vendasHoje / metaDiaria, 1)})`, transformOrigin: 'left', width: '100%', background: acimaMeta
          ? 'linear-gradient(90deg, oklch(52% 0.10 140), oklch(65% 0.12 140))'
          : 'linear-gradient(90deg, oklch(66% 0.15 45), oklch(75% 0.12 85))', transition: 'transform 0.9s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 0 12px oklch(66% 0.15 45 / 0.4)' }} />
      </div>
    </div>}

    <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Flame aria-hidden="true" size={15} color="var(--amarelo)" /> Break-even de Hoje</span>
        <span style={{ fontSize: 12, fontWeight: 600, color: acimaBreak ? 'var(--verde)' : 'var(--vermelho)' }}>
          {breakEvenHoje > 0 ? (acimaBreak ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CheckCircle2 aria-hidden="true" size={13} /> Acima da meta</span> : 'Abaixo da meta') : 'Sem meta definida'}
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, marginTop: 4 }}>{fmtCurrency(breakEvenHoje)}<span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}> /dia</span></div>
      {breakEvenHoje > 0 && <div style={{ height: 8, background: 'var(--bg)', borderRadius: 8, overflow: 'hidden', marginTop: 8 }}>
        <div style={{ height: '100%', borderRadius: 8, transform: `scaleX(${Math.min(vendasHoje / breakEvenHoje, 1)})`, transformOrigin: 'left', width: '100%', background: acimaBreak
          ? 'linear-gradient(90deg, oklch(52% 0.10 140), oklch(65% 0.12 140))'
          : 'linear-gradient(90deg, oklch(50% 0.17 28), oklch(62% 0.15 45))', transition: 'transform 0.9s cubic-bezier(0.16,1,0.3,1)', boxShadow: '0 0 12px oklch(50% 0.17 28 / 0.4)' }} />
      </div>}
    </div>

    <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <BarChart3 aria-hidden="true" size={15} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 13 }}>Receitas vs Despesas (7 dias)</span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={evolucao.length > 0 ? evolucao : [{ dia: 'Sem dados', receitas: 0, despesas: 0 }]} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="gradReceitas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(65% 0.12 140)" stopOpacity={1} />
              <stop offset="100%" stopColor="oklch(52% 0.10 140)" stopOpacity={0.85} />
            </linearGradient>
            <linearGradient id="gradDespesas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(58% 0.16 28)" stopOpacity={1} />
              <stop offset="100%" stopColor="oklch(48% 0.16 28)" stopOpacity={0.85} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="dia" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: string) => v.slice(5)} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: number) => 'R$' + (v / 100).toFixed(0)} axisLine={false} tickLine={false} width={42} />
          <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} cursor={{ fill: 'var(--border)', opacity: 0.2 }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,.3)' }} />
          <Bar dataKey="receitas" name="Receitas" fill="url(#gradReceitas)" radius={[6, 6, 0, 0]} maxBarSize={18} />
          <Bar dataKey="despesas" name="Despesas" fill="url(#gradDespesas)" radius={[6, 6, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>
    </div>

    {evolucaoMensal.length > 0 && <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <LineChartIcon aria-hidden="true" size={15} color="var(--verde)" />
        <span style={{ fontWeight: 600, fontSize: 13 }}>Evolução Mensal (6 meses)</span>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={evolucaoMensal} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradLinhaVerde" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(65% 0.12 140)" stopOpacity={1} />
              <stop offset="100%" stopColor="oklch(65% 0.12 140)" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="gradLinhaVermelho" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="oklch(58% 0.16 28)" stopOpacity={1} />
              <stop offset="100%" stopColor="oklch(58% 0.16 28)" stopOpacity={0.15} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: string) => { const [y, m] = v.split('-'); return ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][parseInt(m)] || v }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} tickFormatter={(v: number) => (v / 1000).toFixed(0) + 'k'} axisLine={false} tickLine={false} width={40} />
          <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, boxShadow: '0 6px 20px rgba(0,0,0,.3)' }} />
          <Line type="monotone" dataKey="receitas" name="Receitas" stroke="url(#gradLinhaVerde)" strokeWidth={2.5} dot={{ r: 3, fill: 'oklch(65% 0.12 140)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="despesas" name="Despesas" stroke="url(#gradLinhaVermelho)" strokeWidth={2.5} dot={{ r: 3, fill: 'oklch(58% 0.16 28)', strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Line type="monotone" dataKey="lucro" name="Lucro" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)', strokeWidth: 0 }} strokeDasharray="4 4" activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>}

    <div className="section" style={{ marginBottom: 16, borderColor: 'var(--vermelho)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--vermelho)', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock aria-hidden="true" size={15} /> Calendário de Vencimentos</span>
        <button onClick={() => router.push('/contas-a-pagar')} style={{ fontSize: 11, background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Ver todas →</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)' }}>{d}</div>)}
        {(() => {
          const [ano, m] = mes.split('-').map(Number)
          const primeiroDia = new Date(ano, m - 1, 1).getDay()
          const total = new Date(ano, m, 0).getDate()
          const hoje = parseInt(hojeBR().slice(8, 10))
          const cells: React.ReactNode[] = []
          for (let i = 0; i < primeiroDia; i++) cells.push(<div key={'e' + i} />)
          for (let d = 1; d <= total; d++) {
            const ds = `${mes}-${String(d).padStart(2, '0')}`
            const tem = contas.some((c: any) => c.data_vencimento === ds)
            const vencida = tem && d < hoje && mes === hojeBR().slice(0, 7)
            cells.push(
              <div key={d} onClick={() => tem && router.push('/contas-a-pagar')} style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, fontSize: 11,
                background: vencida ? 'oklch(60% 0.2 20 / 0.25)' : tem ? 'oklch(60% 0.15 55 / 0.25)' : 'transparent',
                color: tem ? 'var(--fg)' : 'var(--muted)', fontWeight: tem ? 700 : 400, cursor: tem ? 'pointer' : 'default',
              }}>{d}</div>
            )
          }
          return cells
        })()}
      </div>
    </div>

    {contasVencer.length > 0 && <div className="section" style={{ marginBottom: 16, borderColor: 'var(--vermelho)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--vermelho)', display: 'flex', alignItems: 'center', gap: 6 }}><CalendarClock aria-hidden="true" size={15} /> Contas a Vencer</span>
        <button onClick={() => router.push('/contas-a-pagar')} style={{ fontSize: 11, background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Ver todas →</button>
      </div>
      {contasVencer.map((c: any) => {
        const venc = new Date(c.data_vencimento + 'T00:00:00')
        const dd = Math.ceil((venc.getTime() - Date.now()) / 86400000)
        return <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
          <div><span style={{ fontWeight: 500 }}>{c.descricao}</span><span style={{ color: 'var(--muted)', marginLeft: 6 }}>{dd <= 0 ? 'VENCIDA' : dd + 'd'}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 600, color: dd <= 0 ? 'var(--vermelho)' : 'var(--amarelo)' }}>{fmtCurrency(c.valor)}</span>
            <button onClick={() => { setPagandoConta(c); setPgData(c.data_vencimento > hojeBR() ? hojeBR() : hojeBR()) }}
              disabled={pagarMutation.isPending}
            style={{ padding: '3px 8px', borderRadius: 4, border: 'none', background: 'var(--accent)', color: 'var(--bg)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>Pagar</button>
          </div>
        </div>
      })}
    </div>}

    {ranking.length > 0 && <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><TrendingDown aria-hidden="true" size={15} color="var(--vermelho)" /> Ranking de Vilões</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <ResponsiveContainer width={130} height={130}>
          <PieChart>
            <Pie data={ranking} dataKey="total" nameKey="categoria" cx="50%" cy="50%" outerRadius={55} innerRadius={28}
              onClick={(d: any) => { if (d?.categoria) router.push(`/lancamentos?categoria=${encodeURIComponent(d.categoria)}`) }}
              style={{ cursor: 'pointer' }}>
              {ranking.map((_: any, i: number) => <Cell key={i} fill={CORES_PIE[i % CORES_PIE.length]} />)}
            </Pie>
            <Tooltip formatter={(v: any) => fmtCurrency(Number(v))} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1 }}>
          {ranking.slice(0, 5).map((r: any, i: number) => (
            <div key={i} onClick={() => router.push(`/lancamentos?categoria=${encodeURIComponent(r.categoria)}`)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, fontSize: 12, cursor: 'pointer' }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: CORES_PIE[i] }} />
              <span style={{ flex: 1 }}>{r.categoria}</span>
              <span style={{ fontWeight: 600 }}>{fmtCurrency(r.total)}</span>
              <span style={{ color: r.percentual > 30 ? 'var(--vermelho)' : 'var(--muted)', fontSize: 11 }}>{r.percentual}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>}

    {lancHoje.length > 0 && <div className="section" style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Coins aria-hidden="true" size={15} color="var(--amarelo)" /> Movimentações de Hoje</div>
      {lancHoje.slice(0, 6).map((l: any) => {
        const isR = l.tipo === 'receita'
        return <div key={l.id} className="today-item" style={{ padding: '8px 0' }}>
          <div className="item-left">
            <div className={`item-icon ${isR ? 'receita' : 'despesa'}`}>
              {isR ? <ArrowUpCircle aria-hidden="true" size={17} color="var(--verde)" /> : <ArrowDownCircle aria-hidden="true" size={17} color="var(--vermelho)" />}
            </div>
            <div><div className="item-desc">{l.descricao || (isR ? 'Venda' : 'Despesa')}</div><div className="item-cat">{l.categoria_nome || ''}</div></div>
          </div>
          <div className={`item-valor ${isR ? 'receita' : 'despesa'}`}>{isR ? '+' : '-'}{fmtCurrency(l.valor)}</div>
        </div>
      })}
    </div>}

    <div className="section" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Sparkles aria-hidden="true" size={15} color="var(--accent)" />
        <span style={{ fontWeight: 600, fontSize: 13 }}>IA Assistente</span>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <input value={iaQuery} onChange={e => setIaQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && perguntarIA()}
          placeholder="Pergunte..." className="form-input" style={{ flex: 1, height: 40 }} />
        <button onClick={() => perguntarIA()} disabled={iaLoading || !iaQuery.trim()} className="btn btn-primary" style={{ width: 40, height: 40, padding: 0, flex: 'none' }}>
          {iaLoading ? <Clock aria-hidden="true" size={17} /> : <Send aria-hidden="true" size={16} />}
        </button>
      </div>
      <div className="exemplos" style={{ marginTop: 6 }}>
        {['Quanto vendi essa semana?', 'Maior despesa?', 'Resumo financeiro?', 'Contas para pagar?'].map(ex => (
          <button key={ex} onClick={() => perguntarIA(ex)} className="exemplo" style={{ fontSize: 11 }}>{ex}</button>
        ))}
      </div>
      {iaResp && <div style={{ marginTop: 8, padding: 10, background: 'var(--bg)', borderRadius: 8, fontSize: 12, lineHeight: 1.5, border: '1px solid var(--accent)' }}>
        <div style={{ fontSize: 10, color: 'var(--accent)', marginBottom: 4, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><Sparkles aria-hidden="true" size={11} /> RESPOSTA</div>{iaResp}
      </div>}
    </div>

    <button onClick={() => router.push('/novo-lancamento')} className="fab" style={{ bottom: 80, right: 20 }} title="Lançar compra"><Plus aria-hidden="true" size={26} strokeWidth={2.4} /></button>

    {pagandoConta && <Modal titulo={`Pagar: ${pagandoConta.descricao}`} onClose={() => setPagandoConta(null)}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>
          Valor: <strong style={{ color: 'var(--vermelho)' }}>{fmtCurrency(parseFloat(String(pagandoConta.valor)) || 0)}</strong>
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>Data em que foi pago</div>
        <input className="form-input" type="date" value={pgData} onChange={e => setPgData(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
        <button onClick={() => { if (pgData) pagarMutation.mutate({ id: pagandoConta.id, desc: pagandoConta.descricao, valor: pagandoConta.valor, data: pgData }); setPagandoConta(null) }}
          disabled={pagarMutation.isPending} className="btn btn-primary" style={{ width: '100%', height: 44 }}>
          {pagarMutation.isPending ? <><Clock aria-hidden="true" size={16} /> Pagando...</> : <><CheckCircle2 aria-hidden="true" size={16} /> Confirmar Pagamento (entra no fluxo)</>}
        </button>
    </Modal>}
  </>

  async function perguntarIA(q?: string) {
    const query = q || iaQuery
    if (!query.trim()) return
    setIaLoading(true); setIaResp('')
    try {
      const res = await apiPost('/api/ia/pergunta', { pergunta: query, contexto: resumo || {} })
      setIaResp(res?.resposta || 'Não consegui responder.')
    } catch { setIaResp('Erro ao consultar IA.') }
    setIaQuery(''); setIaLoading(false)
  }
}
