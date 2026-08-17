import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const dataParam = searchParams.get("data") || new Date().toISOString().slice(0, 10)
  const supabase = getAdmin()

  try {
    const { data: fechamentoHoje } = await supabase
      .from("fechamento_dia")
      .select("total_vendas, total_despesas, lucro_bruto")
      .eq("data", dataParam)
      .maybeSingle()

    const semanaPassada = new Date(dataParam + "T12:00:00")
    semanaPassada.setDate(semanaPassada.getDate() - 7)
    const dataSemana = semanaPassada.toISOString().slice(0, 10)

    const { data: fechamentoSemana } = await supabase
      .from("fechamento_dia")
      .select("total_vendas, total_despesas, lucro_bruto")
      .eq("data", dataSemana)
      .maybeSingle()

    const { data: lancHoje } = await supabase
      .from("lancamentos")
      .select("valor, tipo")
      .eq("data", dataParam)
      .is("deleted_at", null)

    const { data: lancSemana } = await supabase
      .from("lancamentos")
      .select("valor, tipo")
      .eq("data", dataSemana)
      .is("deleted_at", null)

    function calc(arr: any[] | null) {
      let receitas = 0, despesas = 0
      for (const l of arr || []) {
        const v = parseFloat(l.valor || 0)
        if (l.tipo === "receita") receitas += v
        else despesas += v
      }
      return { receitas, despesas, saldo: Math.round((receitas - despesas) * 100) / 100 }
    }

    const usarFechamento = (fc: any, v: number) => fc ? parseFloat(fc.total_vendas) || 0 : v

    const hojeCalc = calc(lancHoje)
    const semanaCalc = calc(lancSemana)
    const vendasHoje = usarFechamento(fechamentoHoje, hojeCalc.receitas)
    const vendasSemana = usarFechamento(fechamentoSemana, semanaCalc.receitas)
    const despesasHoje = fechamentoHoje ? parseFloat(fechamentoHoje.total_despesas) || 0 : hojeCalc.despesas
    const despesasSemana = fechamentoSemana ? parseFloat(fechamentoSemana.total_despesas) || 0 : semanaCalc.despesas

    return NextResponse.json({
      hoje: {
        data: dataParam,
        vendas: vendasHoje,
        despesas: despesasHoje,
        resultado: Math.round((vendasHoje - despesasHoje) * 100) / 100,
        vazio: (lancHoje?.length || 0) === 0 && !fechamentoHoje,
      },
      semana_passada: {
        data: dataSemana,
        vendas: vendasSemana,
        despesas: despesasSemana,
        resultado: Math.round((vendasSemana - despesasSemana) * 100) / 100,
        vazio: (lancSemana?.length || 0) === 0 && !fechamentoSemana,
      },
      comparativo: {
        vendas: Math.round((vendasHoje - vendasSemana) * 100) / 100,
        resultado: Math.round(((vendasHoje - despesasHoje) - (vendasSemana - despesasSemana)) * 100) / 100,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}