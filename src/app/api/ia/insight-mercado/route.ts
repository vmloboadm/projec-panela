import { NextResponse } from "next/server"
import { callOmniroute, requireAuth } from "@/lib/api"
import { getMarketDados, ACOES } from "@/lib/market"

let cache: { insight: string; ts: number } | null = null
const CACHE_MS = 30 * 60 * 1000

function varMensal(a: any): number | null {
  const c = a?.candles || []
  if (c.length < 2) return null
  const prim = c[0].c
  const ult = c[c.length - 1].c
  if (!prim || prim === 0) return null
  return (ult / prim - 1) * 100
}

function media(ws: { pct: number | null }[]): number | null {
  const vals = ws.filter(w => w.pct != null).map(w => w.pct as number)
  if (vals.length === 0) return null
  return vals.reduce((s, v) => s + v, 0) / vals.length
}

const fmtTend = (v: number | null) => v == null ? "sem dados" : `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  if (cache && Date.now() - cache.ts < CACHE_MS) {
    return NextResponse.json({ insight: cache.insight, cache: true, ok: true })
  }

  const { dados } = await getMarketDados().catch(() => ({ dados: [] as any[], acoesOk: false, commoditiesOk: false }))

  if (dados.length === 0) {
    return NextResponse.json({ insight: "Sem cotações agora — os candles aparecem assim que o mercado responder.", ok: true })
  }

  const frig = dados.filter((d: any) => ["JBSS3", "MBRF3", "BEEF3"].includes(d.ticker))
  const varejo = dados.filter((d: any) => ["ASAI3", "GMAT3"].includes(d.ticker))
  const agric = dados.filter((d: any) => ["ZC", "ZW", "ZS"].includes(d.ticker))

  const fMes = fmtTend(media(frig.map(f => ({ pct: varMensal(f) }))))
  const vMes = fmtTend(media(varejo.map(v => ({ pct: varMensal(v) }))))
  const aMes = fmtTend(media(agric.map(a => ({ pct: varMensal(a) }))))

  const fLinha = frig.map((f: any) => `${f.nome} (${f.ticker}) ${f.pct != null ? `${f.pct >= 0 ? "+" : ""}${f.pct.toFixed(1)}% hoje` : "n/d"} [mês ${fmtTend(varMensal(f))}]`).join("; ")
  const vLinha = varejo.map((v: any) => `${v.nome} (${v.ticker}) ${v.pct != null ? `${v.pct >= 0 ? "+" : ""}${v.pct.toFixed(1)}% hoje` : "n/d"} [mês ${fmtTend(varMensal(v))}]`).join("; ")
  const aLinha = agric.map((a: any) => `${a.nome} ${a.pct != null ? `${a.pct >= 0 ? "+" : ""}${a.pct.toFixed(1)}% hoje` : "n/d"} [mês ${fmtTend(varMensal(a))}]`).join("; ")

  const prompt = `Dados de mercado de hoje para um restaurante de churrasco/self-service:

FRIGORÍFICOS (cadeia da carne bovina) — moyenne mensal: ${fMes}:
${fLinha}

VAREJO DE ALIMENTOS (demanda de consumo) — médio mensal: ${vMes}:
${vLinha}

AGRÍCOLAS (milho/trigo/soja = ração, pão, óleo, massas) — média mensal: ${aMes}:
${aLinha}

Gere uma análise curta de mercado (3 linhas), com correlação direta com o custo do restaurante:
1. Primeira linha: o que a tendência dos frigoríficos indica para o preço da CARNE nas próximas semanas (subindo/estável/caindo) e se vale a pena comprar volume agora ou negociar.
2. Segunda linha: o que a tendência agrícola (milho/trigo/soja) indica para pão, óleo, massas e ração (que pressiona carne/frango).
3. Terceira linha: 1 ação concreta e curta (ex: "comprar antes", "negociar com fornecedor", "manter estoque").

Use frases específicas tipo "os frigoríficos subiram X% no mês — historicamente isso antecede alta da carne em poucas semanas". Não seja genérico. Em português, sem markdown, sem JSON.`

  try {
    const insight = await callOmniroute(
      prompt,
      'Você é analista de mercado de insumos para restaurante brasileiro. Fale de correlações concretas entre ações/commodities e o preço real de carne, pão, óleo e massas. Máximo 3 linhas, em português, sem markdown e sem JSON.',
      320
    )

    if (!insight || insight.trim().length < 8) throw new Error("resposta vazia")

    cache = { insight: insight.trim(), ts: Date.now() }
    return NextResponse.json({ insight: insight.trim(), cache: false, ok: true })
  } catch {
    const fallback = `Frigoríficos no mês: ${fMes} (JBS/Marfrig/Minerva). Agrícolas (milho/trigo/soja): ${aMes}. ${aMes.includes("-") ? "Se as agrícolas caem, pão e óleo tendem a aliviar — mantenha estoque." : "Com agrícolas em alta, pão/óleo/massas tendem a subir — considere comprar antes e negociar com o fornecedor."} Varejo ${vMes.includes("-") ? "em queda" : "em alta"} sugere ${vMes.includes("-") ? "demanda fraca — bom momento para pedir desconto" : "consumo firme — prepare a compra com antecedência"}.`
    return NextResponse.json({ insight: fallback, ok: true, cache: false })
  }
}