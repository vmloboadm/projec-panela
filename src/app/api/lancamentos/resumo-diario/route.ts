import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getLancamentosResumoDiario } from "@/lib/queries"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const dataParam = searchParams.get("data") || new Date().toISOString().slice(0, 10)
  const supabase = getAdmin()

  try {
    const allLanc = await getLancamentosResumoDiario(supabase)
    const ontem = new Date(dataParam + "T12:00:00")
    ontem.setDate(ontem.getDate() - 1)
    const dataOntem = ontem.toISOString().slice(0, 10)

    const hojeArr = allLanc.filter((l: any) => l.data === dataParam)
    const ontemArr = allLanc.filter((l: any) => l.data === dataOntem)

    function calc(arr: any[]) {
      let receitas = 0, despesas = 0
      for (const l of arr) {
        const v = parseFloat(l.valor || 0)
        if (l.tipo === "receita") receitas += v
        else despesas += v
      }
      return { receitas, despesas, saldo: receitas - despesas, total: arr.length }
    }

    const hoje = calc(hojeArr)
    const ontemData = calc(ontemArr)

    const { data: fechamento } = await supabase
      .from("fechamento_dia")
      .select("total_vendas, total_despesas, lucro_bruto, observacoes")
      .eq("data", dataParam)
      .single()

    return NextResponse.json({
      data: dataParam,
      hoje,
      ontem: ontemData,
      semana: calc(allLanc),
      fechamento: fechamento ? {
        total_vendas: (fechamento as any).total_vendas,
        total_despesas: (fechamento as any).total_despesas,
        lucro: (fechamento as any).lucro_bruto,
        observacoes: (fechamento as any).observacoes,
      } : null,
      comparativo: {
        vendas_vs_ontem: hoje.receitas - ontemData.receitas,
        despesas_vs_ontem: hoje.despesas - ontemData.despesas,
        lucro_vs_ontem: hoje.saldo - ontemData.saldo,
      }
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
