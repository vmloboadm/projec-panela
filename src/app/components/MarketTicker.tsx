'use client'
import { useQuery } from '@tanstack/react-query'
import { useAuth, fmtCurrency } from '@/app/components/useAuth'
import { Activity, Clock, Lightbulb } from 'lucide-react'

const COR_ALTA = '#2ecc71'
const COR_BAIXA = '#e74c3c'

function CandlestickChart({ candles }: { candles: any[] }) {
  if (!candles || candles.length < 2) return <div style={{ fontSize: 10, color: 'var(--muted)', padding: '8px 0' }}>Histórico insuficiente</div>

  const W = 148, H = 64, PAD = 4
  const highs = candles.map(c => c.h)
  const lows = candles.map(c => c.l)
  let max = Math.max(...highs), min = Math.min(...lows)
  if (max === min) { max += 1; min -= 1 }
  const span = max - min
  const bw = W / candles.length

  const y = (v: number) => PAD + (max - v) / span * (H - PAD * 2)

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {candles.map((c, i) => {
        const x = i * bw + bw / 2
        const up = c.c >= c.o
        const cor = up ? COR_ALTA : COR_BAIXA
        const yO = y(c.o), yC = y(c.c)
        const corpoY = Math.min(yO, yC)
        const corpoH = Math.max(Math.abs(yC - yO), 1)
        return (
          <g key={i}>
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={cor} strokeWidth={1} />
            <rect x={x - bw * 0.28} y={corpoY} width={bw * 0.56} height={corpoH} fill={cor} rx={0.5} />
          </g>
        )
      })}
    </svg>
  )
}

export default function MarketTicker() {
  const { loading: authLoading, apiGet } = useAuth()

  const q = useQuery({
    queryKey: ['market-ticker'],
    queryFn: () => apiGet('/api/market-ticker'),
    enabled: !authLoading,
    refetchInterval: 10 * 60 * 1000,
    staleTime: 9 * 60 * 1000,
  })

  const insightQ = useQuery({
    queryKey: ['market-insight'],
    queryFn: () => apiGet('/api/ia/insight-mercado'),
    enabled: !authLoading,
    refetchInterval: 30 * 60 * 1000,
    staleTime: 29 * 60 * 1000,
  })

  const lista: any[] = q.data?.data || []
  const avisos: string[] = q.data?.avisos || []
  const atualizado = q.data?.atualizado_em_display || ''
  const carregando = q.isLoading
  const insight = insightQ.data?.insight || ''
  const insightCarregando = insightQ.isLoading

  const fmtPreco = (a: any) => {
    if (a.preco === null || isNaN(a.preco)) return '—'
    if (a.tipo === 'commodity') return a.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return fmtCurrency(a.preco)
  }

  return (
    <div className="mtk">
      <div className="mtk-head">
        <span className="mtk-titulo"><Activity aria-hidden="true" size={14} color="var(--accent)" /> Mercado & Insumos</span>
        <span className="mtk-hora"><Clock aria-hidden="true" size={11} /> {atualizado ? `Atualizado ${atualizado}` : 'Mercado'}</span>
      </div>

      {carregando ? (
        <div className="mtk-row">
          {[0, 1, 2, 3].map(i => <div key={i} className="mtk-card skeleton-line" style={{ width: 172, height: 120, flex: 'none' }} />)}
        </div>
      ) : !lista.length ? (
        <div style={{ padding: '16px 8px', fontSize: 12, color: 'var(--muted)', textAlign: 'center' }}>
          Configure o token em brapi.dev e adicione em <code>.env.local</code> (BRAPI_TOKEN) para ver as cotações.
        </div>
      ) : (
        <div className="mtk-row">
          {lista.map((a: any) => {
            const pct = a.pct
            const up = pct !== null && pct >= 0
            const down = pct !== null && pct < 0
            return (
              <div key={a.ticker} className="mtk-card" style={{ flex: 'none' }}>
                <div className="mtk-top">
                  <span className="mtk-nome">{a.nome}</span>
                  <span className="mtk-ticker">{a.ticker} · {a.tipo === 'commodity' ? 'commodity' : 'ação'}</span>
                </div>
                <CandlestickChart candles={a.candles} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                  <span className="mtk-preco">{fmtPreco(a)}</span>
                  <span className={`mtk-pct ${up ? 'up' : down ? 'down' : ''}`}>
                    {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%` : 'n/d'}
                  </span>
                </div>
                <div style={{ marginTop: 2, fontSize: 9, color: 'var(--muted)' }}>
                  {a.candles && a.candles.length > 0
                    ? new Date(a.candles[0].data * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : ''}
                  {' → '}
                  {a.candles && a.candles.length > 0
                    ? new Date(a.candles[a.candles.length - 1].data * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mtk-insight">
        <Lightbulb aria-hidden="true" size={13} />
        {insightCarregando ? (
          <span className="mtk-insight-loading">Analisando o mercado…</span>
        ) : insight ? (
          <span>{insight}</span>
        ) : (
          <span className="mtk-insight-loading">Mercado em análise…</span>
        )}
      </div>

      {avisos.length > 0 && (
        <div className="mtk-aviso">{avisos.join(' · ')} {atualizado && `· última atualização ${atualizado}`}</div>
      )}
    </div>
  )
}