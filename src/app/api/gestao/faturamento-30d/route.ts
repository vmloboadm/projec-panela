import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosEvolucao } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const supabase = getAdmin()
  try {
    const hoje = new Date()
    const inicio = new Date(hoje)
    inicio.setDate(hoje.getDate() - 29)
    const dataInicio = inicio.toISOString().slice(0, 10)
    const dataFim = hoje.toISOString().slice(0, 10)

    const lancamentos = await getLancamentosEvolucao(supabase, dataInicio, dataFim)

    let totalReceitas = 0
    let totalDespesas = 0

    for (const l of lancamentos) {
      const v = parseFloat(l.valor || 0)
      if (l.tipo === "receita") totalReceitas += v
      else totalDespesas += v
    }

    // Agrupamento por dia (total líquido = receitas - despesas)
    const porDia: Record<string, { receitas: number; despesas: number }> = {}
    for (const l of lancamentos) {
      const v = parseFloat(l.valor || 0)
      const dia = (l.data || "").slice(0, 10)
      if (!porDia[dia]) porDia[dia] = { receitas: 0, despesas: 0 }
      if (l.tipo === "receita") porDia[dia].receitas += v
      else porDia[dia].despesas += v
    }
    const detalhe = Object.entries(porDia)
      .map(([dia, vals]) => ({ dia, ...vals, liquido: Math.round((vals.receitas - vals.despesas) * 100) / 100 }))
      .sort((a, b) => b.dia.localeCompare(a.dia))

    return NextResponse.json({
      data_inicio: dataInicio,
      data_fim: dataFim,
      total_faturado: Math.round(totalReceitas * 100) / 100,
      total_receitas: Math.round(totalReceitas * 100) / 100,
      total_despesas: Math.round(totalDespesas * 100) / 100,
      saldo_liquido: Math.round((totalReceitas - totalDespesas) * 100) / 100,
      dias_com_venda: new Set((lancamentos.filter(l => l.tipo === "receita").map(l => (l.data || "").slice(0, 10)))).size,
      detalhe,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}