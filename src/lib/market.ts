export const ACOES = [
  { ticker: "JBSS3", nome: "JBS" },
  { ticker: "MBRF3", nome: "Marfrig Global" },
  { ticker: "ASAI3", nome: "Assaí" },
  { ticker: "BEEF3", nome: "Minerva" },
  { ticker: "GMAT3", nome: "Grupo Mateus" },
]

export const COMMODITIES: { symbol: string; nome: string }[] = [
  { symbol: "ZC=F", nome: "Milho" },
  { symbol: "ZW=F", nome: "Trigo" },
  { symbol: "ZS=F", nome: "Soja" },
]

async function fetchBrapiHistorical(ticker: string, nome: string): Promise<any | null> {
  const token = process.env.BRAPI_TOKEN
  if (!token) return null
  const url = `https://brapi.dev/api/v2/stocks/historical?symbols=${ticker}&range=1mo&interval=1d&token=${token}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const json = await res.json()
    const r = json?.results?.[0]
    const hist = r?.data?.historicalDataPrice || []
    if (hist.length === 0) return null
    const candles = hist
      .filter((c: any) => c.close != null)
      .reverse()
      .slice(0, 20)
      .map((c: any) => ({
        data: c.date,
        o: c.open, h: c.high, l: c.low, c: c.close,
      }))
    const ultimo = candles[candles.length - 1]
    const anterior = candles.length > 1 ? candles[candles.length - 2] : null
    const pct = anterior && ultimo && anterior.c != null && anterior.c !== 0
      ? (ultimo.c / anterior.c - 1) * 100
      : null
    return {
      tipo: "acao",
      ticker,
      nome,
      preco: ultimo?.c ?? null,
      pct,
      candles,
    }
  } catch {
    return null
  }
}

async function fetchYahooHistorical(symbol: string, nome: string): Promise<any | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2mo`
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const result = json?.chart?.result?.[0]
    if (!result) return null
    const ctx = result?.indicators?.quote?.[0]
    const ts = result?.timestamp || []
    const candles: any[] = []
    for (let i = 0; i < ts.length; i++) {
      const o = ctx?.open?.[i], h = ctx?.high?.[i], l = ctx?.low?.[i], c = ctx?.close?.[i]
      if (o == null || h == null || l == null || c == null) continue
      candles.push({ data: ts[i], o, h, l, c })
    }
    candles.reverse()
    const ultimos = candles.slice(0, 20)
    const ultimo = ultimos[ultimos.length - 1]
    if (!ultimo) return null
    const anterior = ultimos.length > 1 ? ultimos[ultimos.length - 2] : null
    const pct = anterior ? (ultimo.c / anterior.c - 1) * 100 : null
    return {
      tipo: "commodity",
      ticker: symbol.replace("=F", ""),
      nome,
      preco: ultimo.c,
      pct,
      candles: ultimos,
    }
  } catch {
    return null
  }
}

export async function getMarketDados(): Promise<{ dados: any[]; acoesOk: boolean; commoditiesOk: boolean }> {
  const dados: any[] = []
  let acoesOk = false
  let commoditiesOk = false

  const acoes = await Promise.all(ACOES.map(a => fetchBrapiHistorical(a.ticker, a.nome)))
  const acoesBoa = acoes.filter(Boolean)
  if (acoesBoa.length > 0) {
    dados.push(...acoesBoa)
    acoesOk = true
  }

  const comms = await Promise.all(COMMODITIES.map(c => fetchYahooHistorical(c.symbol, c.nome)))
  const commsBoa = comms.filter(Boolean)
  if (commsBoa.length > 0) {
    dados.push(...commsBoa)
    commoditiesOk = true
  }

  return { dados, acoesOk, commoditiesOk }
}