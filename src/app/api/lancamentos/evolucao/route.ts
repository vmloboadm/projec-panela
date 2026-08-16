import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosEvolucao } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const dias = parseInt(searchParams.get("dias") || "7")
  const supabase = getAdmin()

  const hoje = new Date()
  const inicio = new Date(hoje)
  inicio.setDate(hoje.getDate() - dias + 1)
  const dataInicio = inicio.toISOString().slice(0, 10)
  const dataFim = hoje.toISOString().slice(0, 10)

  try {
    const lancamentos = await getLancamentosEvolucao(supabase, dataInicio, dataFim)
    const diasMap: Record<string, { receitas: number; despesas: number }> = {}
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicio)
      d.setDate(inicio.getDate() + i)
      diasMap[d.toISOString().slice(0, 10)] = { receitas: 0, despesas: 0 }
    }
    for (const l of lancamentos) {
      const v = parseFloat(l.valor || 0)
      if (diasMap[l.data]) {
        if (l.tipo === "receita") diasMap[l.data].receitas += v
        else diasMap[l.data].despesas += v
      }
    }
    const data = Object.entries(diasMap).map(([data, vals]) => ({
      data,
      dia: new Date(data + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      receitas: vals.receitas,
      despesas: vals.despesas,
    }))
    return NextResponse.json({ data, data_inicio: dataInicio, data_fim: dataFim })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
