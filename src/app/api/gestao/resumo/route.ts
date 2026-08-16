import { NextResponse } from "next/server"
import { getAdmin, requireAuth } from "@/lib/api"
import { getConfiguracao, getCustosMes, getLancamentosResumo, getLancamentos7d, getContasAVencer } from "@/lib/queries"

const CATEGORIAS_FIXAS = ["aluguel", "funcionarios", "funcionario", "salarios", "salario", "energia", "luz", "agua", "telefone", "impostos", "outros fixos"]

function normalize(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
}

export async function GET(request: Request) {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth
  const { searchParams } = new URL(request.url)
  const mes = searchParams.get("mes") || new Date().toISOString().slice(0, 7)
  const supabase = getAdmin()

  try {
    const config = await getConfiguracao(supabase)
    const { aluguel_mensal: aluguel, funcionarios_mensal: funcionarios, energia_mensal: energia, agua_mensal: agua, outros_fixos: outros, tolerancia_caixa: tolerancia, preco_carne_padrao_kg } = config
    const custosMes = await getCustosMes(supabase, mes)
    const c = {
      aluguel_mensal: custosMes.aluguel ?? aluguel,
      funcionarios_mensal: custosMes.funcionarios ?? funcionarios,
      energia_mensal: custosMes.energia ?? energia,
      agua_mensal: custosMes.agua ?? agua,
      outros_fixos: (custosMes.internet ?? 0) + (custosMes.impostos ?? 0) + (custosMes.gas ?? 0) + (custosMes.funcionarios_extra ?? 0) + (custosMes.contador ?? 0) + (custosMes.outros ?? outros),
    }
    const totalFixo = c.aluguel_mensal + c.funcionarios_mensal + c.energia_mensal + c.agua_mensal + c.outros_fixos
    const diasNoMes = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)), 0).getDate()
    const custoFixoDiario = diasNoMes > 0 ? totalFixo / diasNoMes : 0

    const lancamentos = await getLancamentosResumo(supabase, mes)

    let totalReceitas = 0, totalDespesas = 0, despesasFixas = 0, despesasVariaveis = 0
    const despesasPorCategoria: Record<string, number> = {}
    const catsCache: Record<string, string> = {}

    for (const l of lancamentos) {
      const v = parseFloat(l.valor || 0)
      const resultado = l.afeta_resultado !== false
      if (l.tipo === "receita") { totalReceitas += v; continue }
      if (!resultado) continue
      totalDespesas += v
      let catNome = (l as any).categoria_nome || "Sem categoria"
      if (!catNome || catNome === "Sem categoria") {
        if (l.categoria_id) {
          if (!catsCache[l.categoria_id]) {
            const { data: cat } = await supabase.from("categorias").select("nome").eq("id", l.categoria_id).single()
            catsCache[l.categoria_id] = (cat as any)?.nome || "Sem categoria"
          }
          catNome = catsCache[l.categoria_id]
        }
      }
      despesasPorCategoria[catNome] = (despesasPorCategoria[catNome] || 0) + v
      if (CATEGORIAS_FIXAS.some(f => normalize(catNome).includes(normalize(f)))) despesasFixas += v
      else despesasVariaveis += v
    }

    const ranking = Object.entries(despesasPorCategoria)
      .map(([categoria, total]) => ({ categoria, total: Math.round(total * 100) / 100, percentual: totalDespesas > 0 ? Math.round(total / totalDespesas * 100) : 0 }))
      .sort((a, b) => b.total - a.total).slice(0, 5)

    const lanc7d = await getLancamentos7d(supabase)
    let receita7d = 0, despesaVar7d = 0
    for (const l of lanc7d) {
      const v = parseFloat(l.valor || 0)
      if (l.afeta_resultado === false) continue
      if (l.tipo === "receita") { receita7d += v; continue }
      let catNome = (l as any).categoria_nome || ""
      if (!catNome && l.categoria_id) {
        if (!catsCache[l.categoria_id]) {
          const { data: cat } = await supabase.from("categorias").select("nome").eq("id", l.categoria_id).single()
          catsCache[l.categoria_id] = (cat as any)?.nome || ""
        }
        catNome = catsCache[l.categoria_id]
      }
      if (!CATEGORIAS_FIXAS.some(f => normalize(catNome).includes(normalize(f)))) despesaVar7d += v
    }

    const dias7 = Math.min(7, Math.ceil((Date.now() - new Date(Date.now() - 7 * 86400000).getTime()) / 86400000))
    const vendaMediaDia = dias7 > 0 ? receita7d / dias7 : 0
    const custoVarMedioDia = dias7 > 0 ? despesaVar7d / dias7 : 0
    const margemContribuicao = vendaMediaDia > 0 ? 1 - (custoVarMedioDia / vendaMediaDia) : 0
    const breakEvenDiario = custoFixoDiario > 0
      ? (margemContribuicao > 0 ? custoFixoDiario / margemContribuicao : custoFixoDiario)
      : 0

    const lucroBruto = totalReceitas - totalDespesas
    const lucroLiquido = totalReceitas - totalDespesas - totalFixo
    const margem = totalReceitas > 0 ? Math.round(lucroLiquido / totalReceitas * 100) : 0

    const contas = await getContasAVencer(supabase, 3)

    const dAnterior = new Date(parseInt(mes.slice(0, 4)), parseInt(mes.slice(5, 7)) - 2, 1)
    const mesAnterior = `${dAnterior.getFullYear()}-${String(dAnterior.getMonth() + 1).padStart(2, '0')}`
    const lancPrev = await getLancamentosResumo(supabase, mesAnterior)
    let recPrev = 0, despPrev = 0
    for (const l of lancPrev) {
      const v = parseFloat(l.valor || 0)
      if (l.afeta_resultado === false) continue
      if (l.tipo === "receita") recPrev += v
      else despPrev += v
    }

    return NextResponse.json({
      mes, faturamento_mes: Math.round(totalReceitas * 100) / 100,
      despesas_variaveis_mes: Math.round(despesasVariaveis * 100) / 100,
      despesas_fixas_mes: Math.round(despesasFixas * 100) / 100,
      total_despesas_mes: Math.round(totalDespesas * 100) / 100,
      custo_fixo_diario: Math.round(custoFixoDiario * 100) / 100,
      custo_fixo_mensal: totalFixo,
      break_even_diario: Math.round(breakEvenDiario * 100) / 100,
      break_even_semanal: Math.round(breakEvenDiario * 7 * 100) / 100,
      venda_media_dia: Math.round(vendaMediaDia * 100) / 100,
      custo_variavel_medio_dia: Math.round(custoVarMedioDia * 100) / 100,
      margem_contribuicao: Math.round(margemContribuicao * 100),
      lucro_bruto: Math.round(lucroBruto * 100) / 100,
      lucro_liquido: Math.round(lucroLiquido * 100) / 100,
      margem_lucro: margem,
      ranking_viloes: ranking,
      contas_vencer: contas || [],
      mes_anterior: {
        mes: mesAnterior,
        faturamento: Math.round(recPrev * 100) / 100,
        lucro_liquido: Math.round((recPrev - despPrev - totalFixo) * 100) / 100,
      },
      tolerancia_caixa: tolerancia,
      config: { aluguel, funcionarios, energia, agua, outros, tolerancia, preco_carne_padrao_kg },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
