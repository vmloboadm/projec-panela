import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/api"
import { getMarketDados } from "@/lib/market"

let cache: { data: any[]; ts: number } | null = null
const CACHE_MS = 10 * 60 * 1000

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const agora = Date.now()
  if (cache && agora - cache.ts < CACHE_MS) {
    return NextResponse.json({
      data: cache.data,
      cache: true,
      atualizado_em: new Date(cache.ts).toISOString(),
      atualizado_em_display: new Date(cache.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      avisos: [],
      stale: false,
    })
  }

  try {
    const { dados, acoesOk, commoditiesOk } = await getMarketDados()
    if (dados.length > 0) cache = { data: dados, ts: agora }

    return NextResponse.json({
      data: dados,
      cache: false,
      atualizado_em: new Date().toISOString(),
      atualizado_em_display: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      avisos: [
        ...(!acoesOk ? ["Ações indisponíveis no momento" as string] : []),
        ...(!commoditiesOk ? ["Commodities indisponíveis no momento" as string] : []),
      ],
      stale: false,
    })
  } catch (e: any) {
    if (cache) {
      return NextResponse.json({
        data: cache.data,
        cache: true,
        atualizado_em: new Date(cache.ts).toISOString(),
        atualizado_em_display: new Date(cache.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        avisos: ["Sem conexão com o mercado. Mostrando último valor salvo."],
        stale: true,
      })
    }
    return NextResponse.json({ error: e.message, data: [] }, { status: 200 })
  }
}