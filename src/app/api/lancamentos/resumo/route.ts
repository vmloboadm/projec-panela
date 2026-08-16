import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosResumo } from "@/lib/queries"

async function getCatName(supabase: any, cache: Record<string, string>, id: string) {
  if (cache[id]) return cache[id]
  const { data } = await supabase.from("categorias").select("nome").eq("id", id).single()
  cache[id] = (data as any)?.nome || "Sem categoria"
  return cache[id]
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)
  const supabase = getAdmin()

  try {
    const all = await getLancamentosResumo(supabase, mes)
    const catsCache: Record<string, string> = {}
    let totalReceitas = 0, totalDespesas = 0
    const despesasPorCategoria: Record<string, number> = {}
    const receitasPorCategoria: Record<string, number> = {}
    let numVendas = 0

    for (const l of all) {
      const v = parseFloat(l.valor || 0)
      const catNome = l.categoria_id ? await getCatName(supabase, catsCache, l.categoria_id) : "Sem categoria"
      if (l.tipo === "receita") {
        totalReceitas += v; numVendas++
        receitasPorCategoria[catNome] = (receitasPorCategoria[catNome] || 0) + v
      } else {
        totalDespesas += v
        despesasPorCategoria[catNome] = (despesasPorCategoria[catNome] || 0) + v
      }
    }

    return NextResponse.json({
      mes,
      total_receitas: totalReceitas,
      total_despesas: totalDespesas,
      saldo: totalReceitas - totalDespesas,
      num_vendas: numVendas,
      ticket_medio: numVendas > 0 ? totalReceitas / numVendas : 0,
      despesas_por_categoria: Object.entries(despesasPorCategoria)
        .map(([categoria, valor]) => ({ categoria, valor, percentual: totalDespesas > 0 ? Math.round(valor / totalDespesas * 100) : 0 }))
        .sort((a, b) => b.valor - a.valor),
      receitas_por_categoria: Object.entries(receitasPorCategoria)
        .map(([categoria, valor]) => ({ categoria, valor }))
        .sort((a, b) => b.valor - a.valor),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
